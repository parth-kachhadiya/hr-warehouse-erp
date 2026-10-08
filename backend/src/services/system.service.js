// System Management: categories, custom fields, health check and Sync System
// (same rules as the CATEGORIES / CUSTOM FIELDS / HEALTH parts of the old script).
const models = require('../models');
const { Category, CustomField, Asset } = models;
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { text } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');
const { getSettings } = require('./settings.service');

const APP_TZ = 'Asia/Kolkata';

/* ---------- Categories ---------- */

async function listCategories() {
  return Category.find({ Active: true }).sort({ CategoryID: 1 }).lean();
}

async function addCategory(input = {}) {
  return withTransaction(async (session) => {
    const name = text(input.name);
    if (!name) throw new AppError(400, 'Category name required.');
    const active = await Category.find({ Active: true }).session(session).lean();
    if (active.some((c) => String(c.Name).toLowerCase() === name.toLowerCase())) throw new AppError(400, 'Category already exists.');
    const CategoryID = await nextId('CAT', session);
    await new Category({ CategoryID, Name: name, Active: true }).save({ session });
    await audit.log('CATEGORY_ADD', 'Category', CategoryID, { name }, session);
    return CategoryID;
  });
}

async function deleteCategory(categoryId) {
  return withTransaction(async (session) => {
    const category = await Category.findOne({ CategoryID: categoryId }).session(session);
    if (!category) throw new AppError(404, 'Category not found.');
    const used = await Asset.exists({ Category: category.Name, Status: { $ne: 'Archived' } }).session(session);
    if (used) throw new AppError(400, 'Category is used by existing assets. Archive/rename those assets first.');
    category.Active = false;
    await category.save({ session });
    await audit.log('CATEGORY_ARCHIVE', 'Category', categoryId, { name: category.Name }, session);
    return true;
  });
}

/* ---------- Custom fields ---------- */

async function listCustomFields(module) {
  const filter = { Active: true };
  if (module) filter.Module = module;
  return CustomField.find(filter).sort({ FieldID: 1 }).lean();
}

async function addCustomField(input = {}) {
  return withTransaction(async (session) => {
    const module = text(input.module) || 'Assets';
    const fieldName = text(input.fieldName);
    if (!fieldName) throw new AppError(400, 'Field name required.');
    const active = await CustomField.find({ Active: true, Module: module }).session(session).lean();
    if (active.some((f) => String(f.FieldName).toLowerCase() === fieldName.toLowerCase())) throw new AppError(400, 'Field already exists.');
    const FieldID = await nextId('FLD', session);
    await new CustomField({ FieldID, Module: module, FieldName: fieldName, Active: true }).save({ session });
    await audit.log('CUSTOM_FIELD_ADD', 'CustomField', FieldID, { module, fieldName }, session);
    return FieldID;
  });
}

async function deleteCustomField(fieldId) {
  return withTransaction(async (session) => {
    const field = await CustomField.findOne({ FieldID: fieldId }).session(session);
    if (!field) throw new AppError(404, 'Field not found.');
    field.Active = false;
    await field.save({ session });
    await audit.log('CUSTOM_FIELD_ARCHIVE', 'CustomField', fieldId, {}, session);
    return true;
  });
}

/* ---------- Health check (getSystemHealth) ---------- */

const DUPLICATE_CHECKS = [
  ['Seller', 'Sellers', 'SellerID'], ['Buyer', 'Buyers', 'BuyerID'], ['Asset', 'Assets', 'AssetID'],
  ['Sale', 'Sales', 'SaleID'], ['Payment', 'Payments', 'PaymentID'], ['Settlement', 'Settlements', 'SettlementID'],
  ['InventoryLedger', 'InventoryLedger', 'MovementID'],
];

async function getSystemHealth() {
  const issues = [];
  for (const [model, label, idField] of DUPLICATE_CHECKS) {
    const dups = await models[model].aggregate([
      { $match: { [idField]: { $nin: ['', null] } } },
      { $group: { _id: `$${idField}`, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    if (dups.length) issues.push(`${label}: duplicate IDs ${dups.map((d) => d._id).join(', ')}`);
  }
  const assets = await Asset.find().lean();
  assets.forEach((a) => {
    const total = (a.QuantityAvailable || 0) + (a.QuantityReserved || 0) + (a.QuantityDelivered || 0) + (a.QuantityRemoved || 0);
    const received = a.QuantityReceived || 0;
    if (Math.abs(total - received) > 0.0001) issues.push(`Asset ${a.AssetID}: quantity mismatch. Received ${received} vs buckets ${total}`);
    if ((a.QuantityAvailable || 0) < 0 || (a.QuantityReserved || 0) < 0) issues.push(`Asset ${a.AssetID}: negative quantity detected.`);
  });
  const settings = await getSettings();
  return { ok: issues.length === 0, version: String(settings.ERPVersion || '2.2'), timezone: APP_TZ, issues };
}

// Sync System button: reloads categories, fields, settings and health in one go.
async function syncSystem() {
  return {
    categories: await listCategories(),
    customFields: await listCustomFields(),
    settings: await getSettings(),
    health: await getSystemHealth(),
    timestamp: Date.now(),
  };
}

module.exports = {
  listCategories, addCategory, deleteCategory,
  listCustomFields, addCustomField, deleteCustomField,
  getSystemHealth, syncSystem,
};
