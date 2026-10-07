// Dashboard numbers. The page asks for these every 3 seconds while it is visible.
const { Asset, Sale, Seller } = require('../models');
const { round2 } = require('../utils/number');
const { revenueBreakdown } = require('./finance.service');
const { getDeadStock } = require('./deadStock.service');
const { getUsedSpace } = require('./inventory.service');
const { getSettings } = require('./settings.service');

async function getDashboard() {
  const settings = await getSettings();
  const [revenue, used, stockRow, payableRow, deadStock, lastSales] = await Promise.all([
    revenueBreakdown(),
    getUsedSpace(),
    Asset.aggregate([
      { $match: { Status: { $nin: ['Sold', 'Archived'] } } },
      { $group: { _id: null, units: { $sum: '$QuantityAvailable' } } },
    ]),
    Seller.aggregate([{ $match: { Active: true } }, { $group: { _id: null, total: { $sum: '$TotalPayable' } } }]),
    getDeadStock(),
    Sale.find().sort({ SaleID: -1 }).limit(5).lean(),
  ]);
  const capacity = settings.WarehouseCapacitySqFt;
  return {
    gmv: revenue.gmv,
    totalRevenue: revenue.totalRevenue,
    revenueBreakdown: revenue.breakdown,
    itemsInStock: stockRow[0] ? stockRow[0].units : 0,
    usedSpace: used,
    capacity,
    rentedFootprint: settings.RentedFootprintSqFt,
    utilization: capacity ? round2((used / capacity) * 100) : 0,
    receivable: revenue.receivable,
    payableToSellers: round2(payableRow[0] ? payableRow[0].total : 0),
    deadStockAlerts: deadStock.filter((d) => d.DaysInStock >= 30).length,
    lastSales,
    erpVersion: settings.ERPVersion,
  };
}

module.exports = { getDashboard };
