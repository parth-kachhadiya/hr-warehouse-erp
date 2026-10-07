// System Management: categories, custom fields and the health check.
const models = require('../models');
const { Category, CustomField, Asset } = models;
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');

const text = (v) => String(v ?? '').trim();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- Categories ---------- */

async function listCategories({ includeInactive = false } = {}) {
  return Category.find(includeInactive ? {} : { Active: true }).sort({ Name: 1 }).lean();
}

async function addCategory(input) {
  const Name = text(input.Name);
  if (!Name) throw new AppError(400, 'Category name is required');
  return withTransaction(async (session) => {
    const existing = await Category.findOne({ Name: new RegExp(`^${escapeRegex(Name)}$`, 'i') }).session(session);
    if (existing && existing.Active) throw new AppError(400, 'Category already exists');
    if (existing) {
      existing.Active = true; // bring back a removed category with the same name
      await existing.save({ session });
      await audit.log('RESTORE_CATEGORY', 'Category', existing.CategoryID, { Name }, session);
      return existing.toObject();
    }
    const CategoryID = await nextId('CAT', session);
    const category = await new Category({ CategoryID, Name, Active: true }).save({ session });
    await audit.log('ADD_CATEGORY', 'Category', CategoryID, { Name }, session);
    return category.toObject();
  });
}

async function removeCategory(categoryId) {
  return withTransaction(async (session) => {
    const category = await Category.findOne({ CategoryID: categoryId }).session(session);
    if (!category) throw new AppError(404, 'Category not found');
    const inUse = await Asset.countDocuments({ Category: category.Name, Status: { $ne: 'Archived' } }).session(session);
    if (inUse > 0) throw new AppError(400, `Cannot remove: ${inUse} product(s) still use this category.`);
    category.Active = false;
    await category.save({ session });
    await audit.log('REMOVE_CATEGORY', 'Category', categoryId, { Name: category.Name }, session);
    return category.toObject();
  });
}

/* ---------- Custom fields ---------- */

async function listCustomFields({ includeInactive = false } = {}) {
  const filter = { Module: 'Assets', ...(includeInactive ? {} : { Active: true }) };
  return CustomField.find(filter).sort({ FieldID: 1 }).lean();
}

async function addCustomField(input) {
  const FieldName = text(input.FieldName);
  if (!FieldName) throw new AppError(400, 'Field name is required');
  return withTransaction(async (session) => {
    const existing = await CustomField.findOne({ Module: 'Assets', FieldName: new RegExp(`^${escapeRegex(FieldName)}$`, 'i'), Active: true }).session(session);
    if (existing) throw new AppError(400, 'Field already exists');
    const FieldID = await nextId('FLD', session);
    const field = await new CustomField({ FieldID, Module: 'Assets', FieldName, Active: true }).save({ session });
    await audit.log('ADD_CUSTOM_FIELD', 'CustomField', FieldID, { FieldName }, session);
    return field.toObject();
  });
}

async function removeCustomField(fieldId) {
  return withTransaction(async (session) => {
    const field = await CustomField.findOne({ FieldID: fieldId }).session(session);
    if (!field) throw new AppError(404, 'Custom field not found');
    field.Active = false;
    await field.save({ session });
    await audit.log('REMOVE_CUSTOM_FIELD', 'CustomField', fieldId, { FieldName: field.FieldName }, session);
    return field.toObject();
  });
}

/* ---------- Health check ---------- */

const ID_FIELDS = {
  Seller: 'SellerID', Buyer: 'BuyerID', Asset: 'AssetID', Sale: 'SaleID', Payment: 'PaymentID',
  Settlement: 'SettlementID', StorageLedger: 'EntryID', InventoryLedger: 'MovementID', Category: 'CategoryID',
  CustomField: 'FieldID', Expense: 'ExpenseID', AuditLog: 'AuditID', Reversal: 'ReversalID',
};

// Checks: quantity invariant on every product, duplicate IDs, and rows missing their ID.
async function runHealthCheck() {
  const issues = [];

  const assets = await Asset.find().lean();
  assets.forEach((a) => {
    const sum = a.QuantityAvailable + a.QuantityReserved + a.QuantityDelivered + a.QuantityRemoved;
    if (sum !== a.QuantityReceived) {
      issues.push({ type: 'QUANTITY_MISMATCH', entity: a.AssetID, message: `Received ${a.QuantityReceived} but buckets add up to ${sum}` });
    }
    ['QuantityAvailable', 'QuantityReserved', 'QuantityDelivered', 'QuantityRemoved'].forEach((k) => {
      if (a[k] < 0) issues.push({ type: 'NEGATIVE_QUANTITY', entity: a.AssetID, message: `${k} is ${a[k]}` });
    });
  });

  for (const [name, idField] of Object.entries(ID_FIELDS)) {
    const Model = models[name];
    const dupes = await Model.aggregate([
      { $group: { _id: `$${idField}`, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    dupes.forEach((d) => issues.push({ type: 'DUPLICATE_ID', entity: name, message: `${d._id} appears ${d.count} times` }));
    const missing = await Model.countDocuments({ $or: [{ [idField]: { $exists: false } }, { [idField]: null }, { [idField]: '' }] });
    if (missing) issues.push({ type: 'MISSING_FIELD', entity: name, message: `${missing} row(s) missing ${idField}` });
  }

  return { ok: issues.length === 0, checkedAt: new Date(), assetsChecked: assets.length, issues };
}

module.exports = {
  listCategories, addCategory, removeCategory,
  listCustomFields, addCustomField, removeCustomField,
  runHealthCheck,
};
