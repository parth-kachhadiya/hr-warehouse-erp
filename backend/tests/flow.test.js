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

const get = (Model, filter) => models[Model].findOne(filter).lean();
const fail = async (req, message) => {
  const res = await req;
  assert.equal(res.status >= 400, true, JSON.stringify(res.body));
  if (message) assert.equal(res.body.message, message);
};

test('full product life: intake, sale, payment, delivery, void, settlement, storage', async () => {
  await fail(agent.post('/api/sellers').send({ name: ' ' }), 'Seller name required.');
  const sellerID = ok(await agent.post('/api/sellers').send({ name: 'Ravi Traders', phone: '99999' }), 201);
  assert.equal(sellerID, 'SEL-0001');
  assert.equal((await get('Seller', { SellerID: sellerID })).KYCStatus, 'Pending');
  const buyerID = ok(await agent.post('/api/buyers').send({ name: 'Hotel Surya' }), 201);

  // Capacity: 4000 sq.ft. 50 x 100 = 5000 is blocked with the old message.
  await fail(
    agent.post('/api/assets').send({ itemName: 'Big', quantity: 50, spaceSqFt: 100 }),
    'Warehouse capacity exceeded. Available: 4000 sq.ft, required: 5000 sq.ft for 50 unit(s).'
  );

  const assetID = ok(await agent.post('/api/assets').send({
    itemName: 'Steel Table', category: 'Restaurant Furniture', sellerID,
    quantity: 10, spaceSqFt: 5, reservePrice: 1000, listedPrice: 1500,
  }), 201);
  assert.equal(assetID, 'AST-0001');
  let a = await get('Asset', { AssetID: assetID });
  assert.equal(a.Status, 'In Stock');
  assert.equal(a.ConditionGrade, 'C');
  assert.equal(a.QuantityAvailable, 10);

  // Below reserve needs manager override.
  await fail(
    agent.post('/api/sales').send({ assetID, quantity: 1, unitSalePrice: 900 }),
    'Unit sale price is below reserve price 1000. Confirm manager override to continue.'
  );

  const preview = ok(await agent.post('/api/sales/preview').send({ assetID, quantity: 4, unitSalePrice: 1500 }));
  assert.equal(preview.totalSalePrice, 6000);
  assert.equal(preview.commission.amount, 600);
  assert.equal(preview.belowReserve, false);

  const saleID = ok(await agent.post('/api/sales').send({
    assetID, quantity: 4, unitSalePrice: 1500, marketingCharge: 200, receivedAmount: 1000, buyerID,
  }), 201);
  let sale = await get('Sale', { SaleID: saleID });
  assert.equal(sale.OrderStatus, 'Reserved');
  assert.equal(sale.BuyerName, 'Hotel Surya');
  a = await get('Asset', { AssetID: assetID });
  assert.equal(a.QuantityAvailable, 6);
  assert.equal(a.QuantityReserved, 4);
  let s = await get('Seller', { SellerID: sellerID });
  assert.equal(s.TotalPayable, 5200);

  // Delivery needs full payment.
  await fail(agent.post(`/api/sales/${saleID}/deliver`).send({}), 'Full payment is required before delivery.');
  await fail(agent.post('/api/payments').send({ saleID, amount: 6000 }), 'Payment exceeds remaining balance.');
  const paid = ok(await agent.post('/api/payments').send({ saleID, amount: 5000, mode: 'Cash', notes: 'Balance payment' }), 201);
  assert.equal(paid.paymentStatus, 'Paid');
  assert.equal(paid.orderStatus, 'Ready for Pickup');

  const part = ok(await agent.post(`/api/sales/${saleID}/deliver`).send({ quantity: 1 }));
  assert.equal(part.orderStatus, 'Partially Delivered');
  assert.equal(part.remainingQty, 3);
  await fail(
    agent.post(`/api/sales/${saleID}/void`).send({ reason: 'x' }),
    'An order with delivered units cannot be voided directly. A return/refund workflow is required.'
  );
  const full = ok(await agent.post(`/api/sales/${saleID}/deliver`).send({}));
  assert.equal(full.orderStatus, 'Delivered');

  // Second sale (walk-in) gets voided.
  const sale2 = ok(await agent.post('/api/sales').send({ assetID, quantity: 2, unitSalePrice: 1500, receivedAmount: 500 }), 201);
  assert.equal((await get('Sale', { SaleID: sale2 })).BuyerName, '');
  await fail(agent.post(`/api/sales/${sale2}/void`).send({ reason: '' }), 'Void reason is required.');
  ok(await agent.post(`/api/sales/${sale2}/void`).send({ reason: 'Customer changed mind' }));
  sale = await get('Sale', { SaleID: sale2 });
  assert.equal(sale.OrderStatus, 'Cancelled');
  assert.equal(sale.PaymentStatus, 'Void');
  a = await get('Asset', { AssetID: assetID });
  assert.equal(a.QuantityAvailable, 6);
  assert.equal(a.QuantityReserved, 0);
  assert.equal(a.QuantityDelivered, 4);
  assert.equal(await models.Reversal.countDocuments({ EntityType: 'Sale', EntityID: sale2 }), 2);
  assert.equal(await models.Payment.countDocuments({ SaleID: sale2, Status: 'Void' }), 1);
  assert.equal(ok(await agent.get('/api/sales')).length, 1, 'void sales are hidden');

  // Settlement.
  await fail(agent.post('/api/settlements').send({ sellerID, amount: 99999 }), 'Amount exceeds payable balance 5200.');
  ok(await agent.post('/api/settlements').send({ sellerID, amount: 2000 }), 201);
  s = await get('Seller', { SellerID: sellerID });
  assert.equal(s.TotalPayable, 3200);
  assert.equal(s.TotalSettled, 2000);

  // Seller with stock and buyer with sales cannot be archived.
  await fail(agent.delete(`/api/sellers/${sellerID}`), 'Seller has linked history. Archive seller only after all active stock is cleared.');
  await fail(agent.delete(`/api/buyers/${buyerID}`), 'Buyer has sale history and cannot be deleted. Archive instead.');

  // Adjust, status, archive.
  await fail(agent.post(`/api/assets/${assetID}/adjust`).send({ newTotalQty: 3, reason: 'count' }), 'Cannot reduce total quantity below committed quantity 4.');
  ok(await agent.post(`/api/assets/${assetID}/adjust`).send({ newTotalQty: 12, reason: 'found 2 more' }));
  assert.equal((await get('Asset', { AssetID: assetID })).QuantityAvailable, 8);
  ok(await agent.post(`/api/assets/${assetID}/status`).send({ status: 'Listed' }));

  // Storage billing is idempotent: a second run right after bills nothing new.
  const later = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  const first = await runMonthlyStorageBilling({ now: later });
  const firstTotal = first.reduce((t, r) => t + r.charge, 0);
  assert.ok(firstTotal > 0, 'some rent should be charged');
  assert.equal(first[0].sellerName, 'Ravi Traders');
  assert.equal((await runMonthlyStorageBilling({ now: later })).length, 0);
  s = await get('Seller', { SellerID: sellerID });
  assert.equal(s.TotalPayable, 3200 - firstTotal);
  const space = ok(await agent.get('/api/storage/seller-space'));
  assert.equal(space[0].spaceOccupied, 40);

  ok(await agent.delete(`/api/assets/${assetID}`));
  a = await get('Asset', { AssetID: assetID });
  assert.equal(a.Status, 'Archived');
  assert.equal(a.QuantityRemoved, 8);

  // Reports and health.
  const dash = ok(await agent.get('/api/dashboard'));
  assert.equal(dash.totalGMV, 6000);
  assert.equal(dash.itemsSold, 4);
  const fin = ok(await agent.get('/api/finance/summary'));
  assert.equal(fin.revenue.commission, 600);
  const expID = ok(await agent.post('/api/expenses').send({ category: 'Staff', amount: 300 }), 201);
  const fin2 = ok(await agent.get('/api/finance/summary'));
  assert.equal(fin2.netProfit, fin.revenue.total - 300);
  ok(await agent.delete(`/api/expenses/${expID}`));
  assert.equal(ok(await agent.get('/api/expenses')).length, 0);

  // Categories and custom fields.
  await fail(agent.post('/api/system/categories').send({ name: 'other' }), 'Category already exists.');
  ok(await agent.post('/api/system/custom-fields').send({ module: 'Assets', fieldName: 'Brand' }), 201);
  const sync = ok(await agent.post('/api/system/sync'));
  assert.equal(sync.customFields.length, 1);

  const health = ok(await agent.get('/api/system/health'));
  assert.equal(health.ok, true, JSON.stringify(health.issues));
  assert.equal(health.version, '2.4-SPEED');
  const auditRows = ok(await agent.get('/api/audit?limit=150'));
  assert.ok(auditRows.some((r) => r.Action === 'SALE_VOID'));
});

test('storage space-days maths', () => {
  const { spaceDaysAccrued } = require('../src/services/storageBilling.service');
  const bounds = { start: new Date('2026-10-01T00:00:00+05:30'), end: new Date('2026-11-01T00:00:00+05:30') };
  const now = new Date('2026-10-11T00:00:00+05:30');
  const moves = [
    { Timestamp: new Date('2026-09-20T00:00:00+05:30'), PhysicalQtyDelta: 2 },
    { Timestamp: new Date('2026-10-06T00:00:00+05:30'), PhysicalQtyDelta: -1 },
  ];
  // (2 units x 5 days + 1 unit x 5 days) x 2 sq.ft = 30 space-days
  assert.equal(Math.round(spaceDaysAccrued({ SpaceSqFt: 2 }, moves, bounds, now) * 1000) / 1000, 30);
});
