// Dashboard numbers (same as getDashboardData in the old script).
// The page asks for these every 3 seconds while it is open.
const { Asset, Sale, Seller, Buyer, StorageLedger } = require('../models');
const { DAY_MS } = require('../utils/date');
const { physicalQty } = require('./inventory.service');
const { getSettings } = require('./settings.service');

async function getDashboardData() {
  const [sales, sellers, buyerCount, assets, storageRows, settings] = await Promise.all([
    Sale.find({ TransactionStatus: { $ne: 'Void' } }).sort({ Date: 1, SaleID: 1 }).lean(),
    Seller.find({ Active: true }).lean(),
    Buyer.countDocuments({ Active: true }),
    Asset.find({ Status: { $nin: ['Archived', 'Sold'] } }).lean(),
    StorageLedger.find({ Status: { $ne: 'Void' } }).lean(),
    getSettings(),
  ]);
  const now = new Date();

  let totalGMV = 0, receivable = 0, commission = 0, marketing = 0, repair = 0, logistics = 0, itemsSold = 0;
  sales.forEach((x) => {
    const price = Number(x.SalePrice) || 0;
    const received = Number(x.ReceivedAmount) || 0;
    totalGMV += price;
    receivable += Math.max(0, price - received);
    commission += Number(x.CommissionAmount) || 0;
    marketing += Number(x.MarketingCharge) || 0;
    repair += Number(x.RepairCharge) || 0;
    logistics += Number(x.LogisticsCharge) || 0;
    if (x.OrderStatus === 'Delivered') itemsSold += Number(x.Quantity) || 1;
  });
  const storage = storageRows.reduce((t, x) => t + (Number(x.Charge) || 0), 0);
  const payable = sellers.reduce((t, x) => t + Math.max(0, Number(x.TotalPayable) || 0), 0);

  let itemsInStock = 0, usedSqFt = 0, deadAlerts = 0;
  assets.forEach((a) => {
    const pq = physicalQty(a);
    itemsInStock += pq;
    usedSqFt += pq * (Number(a.SpaceSqFt) || 0);
    if (pq > 0 && a.DateReceived && Math.floor((now - new Date(a.DateReceived)) / DAY_MS) >= 30) deadAlerts += 1;
  });
  const capacity = Number(settings.WarehouseCapacitySqFt) || 4000;
  const revenue = { commission, storage, marketing, repair, logistics };
  revenue.total = commission + storage + marketing + repair + logistics;
  return {
    itemsInStock, itemsSold, sellerCount: sellers.length, buyerCount,
    totalGMV, revenueBreakdown: revenue, totalRevenue: revenue.total, totalReceivable: receivable,
    totalPayableToSellers: payable,
    warehouse: {
      usedSqFt, capacitySqFt: capacity, availableSqFt: Math.max(0, capacity - usedSqFt),
      utilizationPct: capacity ? Math.round((usedSqFt / capacity) * 10000) / 100 : 0,
    },
    deadStockAlerts: deadAlerts,
    recentSales: sales.slice(-5).reverse(),
    serverTs: Date.now(),
  };
}

module.exports = { getDashboardData };
