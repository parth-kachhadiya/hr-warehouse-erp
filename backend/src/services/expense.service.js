// Warehouse running costs (rent, staff, utilities...).
const { Expense } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { toNumber, round2 } = require('../utils/number');
const { parseInputDate } = require('../utils/date');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');

const text = (v) => String(v ?? '').trim();

async function listExpenses() {
  return Expense.find().sort({ Date: -1, ExpenseID: -1 }).lean();
}

async function addExpense(input) {
  const amount = round2(toNumber(input.Amount, NaN));
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, 'Amount must be more than 0');
  return withTransaction(async (session) => {
    const ExpenseID = await nextId('EXP', session);
    const expense = await new Expense({
      ExpenseID,
      Date: parseInputDate(input.Date),
      Category: text(input.Category) || 'Other',
      Amount: amount,
      Notes: text(input.Notes),
      Status: 'Active',
    }).save({ session });
    await audit.log('ADD_EXPENSE', 'Expense', ExpenseID, { Category: expense.Category, Amount: amount }, session);
    return expense.toObject();
  });
}

async function voidExpense(expenseId, input = {}) {
  const reason = text(input.reason);
  if (!reason) throw new AppError(400, 'A reason is required to void an expense');
  return withTransaction(async (session) => {
    const expense = await Expense.findOne({ ExpenseID: expenseId }).session(session);
    if (!expense) throw new AppError(404, 'Expense not found');
    if (expense.Status === 'Void') throw new AppError(400, 'Expense is already void');
    expense.Status = 'Void';
    expense.VoidDate = new Date();
    expense.VoidReason = reason;
    await expense.save({ session });
    await audit.log('VOID_EXPENSE', 'Expense', expenseId, { reason, Amount: expense.Amount }, session);
    return expense.toObject();
  });
}

module.exports = { listExpenses, addExpense, voidExpense };
