// Expenses (same as getExpenses / addExpense / deleteExpense in the old script).
const { Expense } = require('../models');
const { nextIds } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { num, text } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');
const { addReversal } = require('./sale.service');

async function getExpenses() {
  return Expense.find({ Status: { $ne: 'Void' } }).sort({ Date: 1, ExpenseID: 1 }).lean();
}

async function addExpense(e) {
  if (!e) throw new AppError(400, 'Expense data missing.');
  const amount = num(e.amount, 'Expense amount', { positive: true });
  const [id, auditID] = await nextIds('EXP', 'AUD'); // both IDs in one round trip
  return withTransaction(async (session) => {
    await new Expense({
      ExpenseID: id, Date: new Date(), Category: text(e.category) || 'Other', Amount: amount, Notes: text(e.notes), Status: 'Active',
    }).save({ session });
    await audit.log('EXPENSE_ADD', 'Expense', id, { amount, category: text(e.category) }, session, auditID);
    return id;
  });
}

async function deleteExpense(id) {
  return withTransaction(async (session) => {
    const expense = await Expense.findOne({ ExpenseID: id }).session(session);
    if (!expense) throw new AppError(404, 'Expense not found.');
    if ((expense.Status || 'Active') === 'Void') throw new AppError(400, 'Expense already voided.');
    if (expense.MaintenanceID) {
      throw new AppError(400, `This expense belongs to maintenance entry ${expense.MaintenanceID}. Void it from the Maintenance page.`);
    }
    const amount = Number(expense.Amount) || 0;
    Object.assign(expense, { Status: 'Void', VoidDate: new Date(), VoidReason: 'Voided from ERP UI' });
    await expense.save({ session });
    await addReversal('Expense', id, amount, 'Expense voided', {}, session);
    await audit.log('EXPENSE_VOID', 'Expense', id, { amount }, session);
    return true;
  });
}

module.exports = { getExpenses, addExpense, deleteExpense };
