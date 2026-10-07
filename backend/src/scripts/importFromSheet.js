// ONE-TIME import of the old Google Sheet data into MongoDB.
//
// 1. In Google Sheets, download each tab as CSV (File > Download > .csv).
// 2. Put them in one folder, named exactly like the tabs: Sellers.csv, Buyers.csv,
//    Assets.csv, Sales.csv, Payments.csv, Settlements.csv, StorageLedger.csv,
//    InventoryLedger.csv, Categories.csv, CustomFields.csv, Expenses.csv,
//    Settings.csv, AuditLog.csv, Reversals.csv  (missing files are skipped).
// 3. Run:  npm run import:sheet -- ./sheet-export
//    Add --wipe to empty the database first (only if you want to redo the import).
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { parse } = require('csv-parse/sync');
const env = require('../config/env');
const connectDB = require('../config/db');
const models = require('../models');
const { seedDefaults } = require('./seed');

const SHEETS = {
  Sellers: 'Seller', Buyers: 'Buyer', Assets: 'Asset', Sales: 'Sale', Payments: 'Payment',
  Settlements: 'Settlement', StorageLedger: 'StorageLedger', InventoryLedger: 'InventoryLedger',
  Categories: 'Category', CustomFields: 'CustomField', Expenses: 'Expense', Settings: 'Setting',
  AuditLog: 'AuditLog', Reversals: 'Reversal',
};

// Sheet dates may look like 2026-10-07 10:15:00 or 07/10/2026 10:15:00 (India format). Treated as IST.
function parseDate(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${(m[4] || '0').padStart(2, '0')}:${m[5] || '00'}:${m[6] || '00'}+05:30`);
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${(m[4] || '0').padStart(2, '0')}:${m[5] || '00'}:${m[6] || '00'}+05:30`);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function convert(Model, row) {
  const doc = {};
  for (const [key, raw] of Object.entries(row)) {
    const pathInfo = Model.schema.path(key);
    if (!pathInfo) continue; // ignore columns the new system does not have
    const value = typeof raw === 'string' ? raw.trim() : raw;
    switch (pathInfo.instance) {
      case 'Number': doc[key] = value === '' ? 0 : Number(String(value).replace(/[₹,\s]/g, '')) || 0; break;
      case 'Date': doc[key] = parseDate(value); break;
      case 'Boolean': doc[key] = ['true', 'yes', '1'].includes(String(value).toLowerCase()); break;
      case 'Array': doc[key] = String(value || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean); break;
      case 'Mixed':
        try { doc[key] = value ? JSON.parse(value) : {}; } catch { doc[key] = { raw: value }; }
        break;
      default: doc[key] = value;
    }
  }
  return doc;
}

async function run() {
  const folder = process.argv[2];
  const wipe = process.argv.includes('--wipe');
  if (!folder || !fs.existsSync(folder)) {
    console.error('Usage: npm run import:sheet -- <folder-with-csv-files> [--wipe]');
    process.exit(1);
  }
  env.validate();
  await connectDB(env.MONGODB_URI);

  if (wipe) {
    for (const name of Object.values(SHEETS)) await models[name].deleteMany({});
    await models.Counter.deleteMany({});
    console.log('Database emptied.');
  } else {
    const existing = await models.Asset.countDocuments() + await models.Sale.countDocuments() + await models.Seller.countDocuments();
    if (existing > 0) {
      console.error('The database already has data. Re-run with --wipe to replace it.');
      process.exit(1);
    }
    await models.Setting.deleteMany({});
    await models.Category.deleteMany({});
  }

  for (const [sheet, modelName] of Object.entries(SHEETS)) {
    const file = path.join(folder, `${sheet}.csv`);
    if (!fs.existsSync(file)) {
      console.log(`- ${sheet}.csv not found, skipped`);
      continue;
    }
    const rows = parse(fs.readFileSync(file), { columns: true, skip_empty_lines: true, bom: true, relax_quotes: true, relax_column_count: true });
    const Model = models[modelName];
    const docs = rows.map((r) => convert(Model, r)).filter((d) => Object.values(d).some((v) => v !== '' && v !== null));
    if (docs.length) await Model.insertMany(docs, { ordered: true });
    console.log(`✓ ${sheet}: ${docs.length} rows`);
  }

  await seedDefaults(); // fills any missing settings and moves ID counters past imported IDs
  console.log('Import finished. Open the app and run System Management > Health Check.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
