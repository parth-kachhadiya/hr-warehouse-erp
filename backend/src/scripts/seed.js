// Adds default Settings and Categories if they are missing, and makes sure the
// ID counters continue after any existing data. Safe to run many times.
// Run by hand with: npm run seed
const models = require('../models');
const { DEFAULT_SETTINGS } = require('../services/settings.service');
const { syncCounter } = require('../utils/idGenerator');

const DEFAULT_CATEGORIES = ['Kitchen Equipment', 'Restaurant Furniture', 'Office Furniture', 'Other'];

const COUNTERS = [
  ['SEL', 'Seller', 'SellerID'], ['BUY', 'Buyer', 'BuyerID'], ['AST', 'Asset', 'AssetID'],
  ['SAL', 'Sale', 'SaleID'], ['PAY', 'Payment', 'PaymentID'], ['STL', 'Settlement', 'SettlementID'],
  ['STG', 'StorageLedger', 'EntryID'], ['MOV', 'InventoryLedger', 'MovementID'], ['CAT', 'Category', 'CategoryID'],
  ['FLD', 'CustomField', 'FieldID'], ['EXP', 'Expense', 'ExpenseID'], ['AUD', 'AuditLog', 'AuditID'],
  ['REV', 'Reversal', 'ReversalID'],
];

async function seedDefaults() {
  const { Setting, Category } = models;
  for (const [Key, Value] of Object.entries(DEFAULT_SETTINGS)) {
    await Setting.updateOne({ Key }, { $setOnInsert: { Key, Value } }, { upsert: true });
  }
  for (const [prefix, model, field] of COUNTERS) {
    await syncCounter(prefix, models[model], field);
  }
  if ((await Category.countDocuments()) === 0) {
    const { nextId } = require('../utils/idGenerator');
    for (const Name of DEFAULT_CATEGORIES) {
      await Category.create({ CategoryID: await nextId('CAT'), Name, Active: true });
    }
  }
}

module.exports = { seedDefaults, COUNTERS };

if (require.main === module) {
  const env = require('../config/env');
  const connectDB = require('../config/db');
  const mongoose = require('mongoose');
  (async () => {
    env.validate();
    await connectDB(env.MONGODB_URI);
    await seedDefaults();
    console.log('Seed complete: default settings and categories are in place.');
    await mongoose.disconnect();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
