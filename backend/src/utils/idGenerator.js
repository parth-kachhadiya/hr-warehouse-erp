// Makes readable IDs like SEL-0001. The counter is increased atomically, so two
// requests at the same moment can never get the same number.
const Counter = require('../models/Counter');

const PREFIXES = {
  Seller: 'SEL',
  Buyer: 'BUY',
  Asset: 'AST',
  Sale: 'SAL',
  Payment: 'PAY',
  Settlement: 'STL',
  StorageLedger: 'STG',
  InventoryLedger: 'MOV',
  Category: 'CAT',
  CustomField: 'FLD',
  Expense: 'EXP',
  AuditLog: 'AUD',
  Reversal: 'REV',
};

const format = (prefix, n) => `${prefix}-${String(n).padStart(4, '0')}`;

async function nextId(prefix, session) {
  const counter = await Counter.findOneAndUpdate(
    { _id: prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return format(prefix, counter.seq);
}

// Moves a counter forward so new IDs continue after existing ones (used by seed/import).
async function syncCounter(prefix, Model, idField) {
  const docs = await Model.find({ [idField]: new RegExp(`^${prefix}-\\d+$`) }, { [idField]: 1 }).lean();
  const max = docs.reduce((m, d) => Math.max(m, Number(d[idField].split('-')[1]) || 0), 0);
  await Counter.updateOne({ _id: prefix }, { $max: { seq: max } }, { upsert: true });
  return max;
}

module.exports = { PREFIXES, nextId, syncCounter, format };
