// Finance: total revenue - expenses = net profit.
const { Sale, StorageLedger, Expense } = require('../models');
const { round2 } = require('../utils/number');

async function revenueBreakdown() {
  const [sales] = await Sale.aggregate([
    { $match: { TransactionStatus: 'Active' } },
    {
      $group: {
        _id: null,
        gmv: { $sum: '$SalePrice' },
        commission: { $sum: '$CommissionAmount' },
        marketing: { $sum: '$MarketingCharge' },
        repair: { $sum: '$RepairCharge' },
        logistics: { $sum: '$LogisticsCharge' },
        receivable: { $sum: { $subtract: ['$SalePrice', '$ReceivedAmount'] } },
      },
    },
  ]);
  const [storage] = await StorageLedger.aggregate([
    { $match: { Status: 'Active' } },
    { $group: { _id: null, total: { $sum: '$Charge' } } },
  ]);
  const s = sales || {};
  const breakdown = {
    commission: round2(s.commission || 0),
    storage: round2(storage ? storage.total : 0),
    marketing: round2(s.marketing || 0),
    repair: round2(s.repair || 0),
    logistics: round2(s.logistics || 0),
  };
  const totalRevenue = round2(Object.values(breakdown).reduce((a, b) => a + b, 0));
  return { gmv: round2(s.gmv || 0), receivable: round2(s.receivable || 0), breakdown, totalRevenue };
}

async function getFinanceSummary() {
  const revenue = await revenueBreakdown();
  const byCategory = await Expense.aggregate([
    { $match: { Status: 'Active' } },
    { $group: { _id: '$Category', total: { $sum: '$Amount' } } },
    { $sort: { _id: 1 } },
  ]);
  const totalExpenses = round2(byCategory.reduce((a, c) => a + c.total, 0));
  return {
    totalRevenue: revenue.totalRevenue,
    revenueBreakdown: revenue.breakdown,
    totalExpenses,
    netProfit: round2(revenue.totalRevenue - totalExpenses),
    expensesByCategory: byCategory.map((c) => ({ Category: c._id, Total: round2(c.total) })),
  };
}

module.exports = { revenueBreakdown, getFinanceSummary };
