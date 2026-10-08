// Finance summary (same as getFinanceSummary in the old script).
const { Sale, StorageLedger, Expense } = require('../models');

async function getFinanceSummary() {
  const sales = await Sale.find({ TransactionStatus: { $ne: 'Void' } }).lean();
  const storageRows = await StorageLedger.find({ Status: { $ne: 'Void' } }).lean();
  const sum = (rows, key) => rows.reduce((t, r) => t + (Number(r[key]) || 0), 0);
  const commission = sum(sales, 'CommissionAmount');
  const storage = sum(storageRows, 'Charge');
  const marketing = sum(sales, 'MarketingCharge');
  const repair = sum(sales, 'RepairCharge');
  const logistics = sum(sales, 'LogisticsCharge');
  const total = commission + storage + marketing + repair + logistics;
  const expenses = await Expense.find({ Status: { $ne: 'Void' } }).lean();
  const totalExpenses = sum(expenses, 'Amount');
  const byCat = {};
  expenses.forEach((e) => { const c = e.Category || 'Other'; byCat[c] = (byCat[c] || 0) + (Number(e.Amount) || 0); });
  return {
    revenue: { commission, storage, marketing, repair, logistics, total },
    totalExpenses,
    expensesByCategory: byCat,
    netProfit: total - totalExpenses,
  };
}

module.exports = { getFinanceSummary };
