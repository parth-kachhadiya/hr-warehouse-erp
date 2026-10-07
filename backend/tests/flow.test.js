// End-to-end check of the main business flow against a throwaway in-memory MongoDB.
// Run with: npm test   (the first run downloads a MongoDB binary, which takes a minute)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-1234567890';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('secret123', 4);
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const { seedDefaults } = require('../src/scripts/seed');
const models = require('../src/models');
const { runMonthlyStorageBilling } = require('../src/services/storageBilling.service');

let replSet;
let agent;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());
  await Promise.all(Object.values(models).map((m) => m.init()));
  await seedDefaults();
  agent = request.agent(app);
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

const ok = (res, status = 200) => {
  assert.equal(res.status, status, JSON.stringify(res.body));
  return res.body.data;
};

test('everything is locked until login', async () => {
  const res = await request(app).get('/api/sellers');
  assert.equal(res.status, 401);
  const bad = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'nope' });
  assert.equal(bad.status, 401);
  ok(await agent.post('/api/auth/login').send({ username: 'admin', password: 'secret123' }));
  ok(await agent.get('/api/auth/me'));
});

test('full product life: intake, sale, payment, delivery, void, settlement, storage', async () => {
  const seller = ok(await agent.post('/api/sellers').send({ Name: 'Ravi Traders', Phone: '99999' }), 201);
  assert.equal(seller.SellerID, 'SEL-0001');
  assert.equal(seller.KYCStatus, 'Pending');
  const buyer = ok(await agent.post('/api/buyers').send({ Name: 'Hotel Surya' }), 201);

  // Capacity: 4000 sq.ft. 50 x 100 = 5000 should be blocked.
  const tooBig = await agent.post('/api/assets').send({ ItemName: 'Big', QuantityReceived: 50, SpaceSqFt: 100 });
  assert.equal(tooBig.status, 400);

  const asset = ok(await agent.post('/api/assets').send({
    ItemName: 'Steel Table', Category: 'Restaurant Furniture', SellerID: seller.SellerID,
    QuantityReceived: 10, SpaceSqFt: 5, ReservePrice: 1000, ListedPrice: 1500,
  }), 201);
  assert.equal(asset.AssetID, 'AST-0001');
  assert.equal(asset.Status, 'In Stock');
  assert.equal(asset.QuantityAvailable, 10);

  // Below reserve needs override.
  const low = await agent.post('/api/sales').send({ AssetID: asset.AssetID, Quantity: 1, UnitSalePrice: 900 });
  assert.equal(low.status, 409);
  assert.equal(low.body.code, 'RESERVE_OVERRIDE_REQUIRED');

  const preview = ok(await agent.post('/api/sales/preview').send({
    AssetID: asset.AssetID, Quantity: 4, UnitSalePrice: 1500, MarketingCharge: 200, ReceivedAmount: 1000,
  }));
  assert.equal(preview.SalePrice, 6000);
  assert.equal(preview.CommissionAmount, 600);
  assert.equal(preview.HRGrossRevenue, 800);
  assert.equal(preview.SellerPayable, 5200);
  assert.equal(preview.PaymentStatus, 'Partial');

  const sale = ok(await agent.post('/api/sales').send({
    AssetID: asset.AssetID, Quantity: 4, UnitSalePrice: 1500, MarketingCharge: 200, ReceivedAmount: 1000, BuyerID: buyer.BuyerID,
  }), 201);
  assert.equal(sale.OrderStatus, 'Reserved');
  let a = await models.Asset.findOne({ AssetID: asset.AssetID }).lean();
  assert.equal(a.QuantityAvailable, 6);
  assert.equal(a.QuantityReserved, 4);
  let s = await models.Seller.findOne({ SellerID: seller.SellerID }).lean();
  assert.equal(s.TotalPayable, 5200);

  // Delivery needs full payment.
  assert.equal((await agent.post(`/api/sales/${sale.SaleID}/deliver`).send({})).status, 400);
  assert.equal((await agent.post(`/api/sales/${sale.SaleID}/payments`).send({ Amount: 6000 })).status, 400);
  const paid = ok(await agent.post(`/api/sales/${sale.SaleID}/payments`).send({ Amount: 5000, Mode: 'UPI' }), 201);
  assert.equal(paid.sale.PaymentStatus, 'Paid');
  assert.equal(paid.sale.OrderStatus, 'Ready for Pickup');

  const part = ok(await agent.post(`/api/sales/${sale.SaleID}/deliver`).send({ Quantity: 1 }));
  assert.equal(part.OrderStatus, 'Partially Delivered');
  assert.equal((await agent.post(`/api/sales/${sale.SaleID}/void`).send({ reason: 'x' })).status, 400);
  const full = ok(await agent.post(`/api/sales/${sale.SaleID}/deliver`).send({}));
  assert.equal(full.OrderStatus, 'Delivered');

  // Second sale gets voided.
  const sale2 = ok(await agent.post('/api/sales').send({ AssetID: asset.AssetID, Quantity: 2, UnitSalePrice: 1500, ReceivedAmount: 500 }), 201);
  assert.equal(sale2.BuyerName, 'Walk-in');
  const voided = ok(await agent.post(`/api/sales/${sale2.SaleID}/void`).send({ reason: 'Customer changed mind' }));
  assert.equal(voided.OrderStatus, 'Cancelled');
  assert.equal(voided.PaymentStatus, 'Void');
  a = await models.Asset.findOne({ AssetID: asset.AssetID }).lean();
  assert.equal(a.QuantityAvailable, 6);
  assert.equal(a.QuantityReserved, 0);
  assert.equal(a.QuantityDelivered, 4);
  assert.equal(await models.Reversal.countDocuments(), 2);
  assert.equal(await models.Payment.countDocuments({ SaleID: sale2.SaleID, Status: 'Void' }), 1);

  // Settlement.
  assert.equal((await agent.post('/api/settlements').send({ SellerID: seller.SellerID, Amount: 99999 })).status, 400);
  ok(await agent.post('/api/settlements').send({ SellerID: seller.SellerID, Amount: 2000 }), 201);
  s = await models.Seller.findOne({ SellerID: seller.SellerID }).lean();
  assert.equal(s.TotalPayable, 3200);
  assert.equal(s.TotalSettled, 2000);

  // Seller with products cannot be archived; buyer with sales cannot be archived.
  assert.equal((await agent.post(`/api/sellers/${seller.SellerID}/archive`)).status, 400);
  assert.equal((await agent.post(`/api/buyers/${buyer.BuyerID}/archive`)).status, 400);

  // Adjust, status, archive.
  assert.equal((await agent.post(`/api/assets/${asset.AssetID}/adjust`).send({ newQuantity: 3, reason: 'count' })).status, 400);
  const adj = ok(await agent.post(`/api/assets/${asset.AssetID}/adjust`).send({ newQuantity: 12, reason: 'found 2 more' }));
  assert.equal(adj.QuantityAvailable, 8);
  ok(await agent.post(`/api/assets/${asset.AssetID}/status`).send({ Status: 'Listed' }));

  // Storage billing is idempotent: second run right after bills nothing new.
  const first = await runMonthlyStorageBilling({ now: new Date(Date.now() + 2 * 24 * 3600 * 1000) });
  assert.ok(first.totalCharge > 0, 'some rent should be charged');
  const again = await runMonthlyStorageBilling({ now: new Date(Date.now() + 2 * 24 * 3600 * 1000) });
  assert.equal(again.entries.length, 0);
  s = await models.Seller.findOne({ SellerID: seller.SellerID }).lean();
  assert.equal(s.TotalPayable, 3200 - first.totalCharge);

  const archived = ok(await agent.post(`/api/assets/${asset.AssetID}/archive`).send({ reason: 'returned' }));
  assert.equal(archived.Status, 'Archived');
  assert.equal(archived.QuantityRemoved, 8);

  // Reports and health.
  const dash = ok(await agent.get('/api/dashboard'));
  assert.equal(dash.gmv, 6000);
  const fin = ok(await agent.get('/api/finance/summary'));
  assert.equal(fin.revenueBreakdown.commission, 600);
  ok(await agent.post('/api/expenses').send({ Category: 'Staff', Amount: 300 }), 201);
  const fin2 = ok(await agent.get('/api/finance/summary'));
  assert.equal(fin2.netProfit, fin.totalRevenue - 300);
  const health = ok(await agent.get('/api/system/health'));
  assert.equal(health.ok, true, JSON.stringify(health.issues));
  const auditRows = ok(await agent.get('/api/audit'));
  assert.ok(auditRows.length > 10);
});

test('storage space-days maths', () => {
  const { unitDaysInWindow } = require('../src/services/storageBilling.service');
  const start = new Date('2026-10-01T00:00:00+05:30');
  const until = new Date('2026-10-11T00:00:00+05:30');
  const moves = [
    { Timestamp: new Date('2026-09-20T00:00:00+05:30'), PhysicalQtyDelta: 2 },
    { Timestamp: new Date('2026-10-06T00:00:00+05:30'), PhysicalQtyDelta: -1 },
  ];
  // 2 units for 5 days + 1 unit for 5 days = 15 unit-days
  assert.equal(Math.round(unitDaysInWindow(moves, start, until).unitDays * 1000) / 1000, 15);
});
