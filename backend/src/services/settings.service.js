// Reads and writes the key/value Settings, turning text into numbers and true/false.
const { Setting } = require('../models');
const AppError = require('../utils/AppError');
const { num } = require('../utils/number');
const { withTransaction } = require('../utils/transaction');
const audit = require('./audit.service');

const DEFAULT_SETTINGS = {
  WarehouseCapacitySqFt: '4000',
  RentedFootprintSqFt: '3000',
  StorageRatePerSqFtPerMonth: '25',
  CommissionTier1Max: '100000',
  CommissionTier1Rate: '0.10',
  CommissionTier2Max: '500000',
  CommissionTier2Rate: '0.10',
  CommissionTier3Rate: '0.10',
  RequireReservePriceApproval: 'true',
  EnforceWarehouseCapacity: 'true',
  MaxPhotoMB: '8',
  MaxVideoMB: '25',
  MediaRootFolderId: 'HR Warehouse Media',
  ERPVersion: '2.4-SPEED',
};

const BOOLEAN_KEYS = ['RequireReservePriceApproval', 'EnforceWarehouseCapacity'];
const TEXT_KEYS = ['MediaRootFolderId', 'ERPVersion'];
const RATE_KEYS = ['CommissionTier1Rate', 'CommissionTier2Rate', 'CommissionTier3Rate'];

function parse(key, value) {
  if (BOOLEAN_KEYS.includes(key)) return String(value).toLowerCase() === 'true';
  if (TEXT_KEYS.includes(key)) return String(value);
  return Number(value);
}

async function getSettings(session) {
  const rows = await Setting.find().session(session || null).lean();
  const raw = { ...DEFAULT_SETTINGS };
  rows.forEach((r) => { raw[r.Key] = r.Value; });
  const settings = {};
  Object.keys(raw).forEach((key) => { settings[key] = parse(key, raw[key]); });
  return settings;
}

// Same checks as updateSettings in the old script; writes one SETTINGS_UPDATE audit row.
async function updateSettings(newSettings = {}) {
  return withTransaction(async (session) => {
    for (const [key, value] of Object.entries(newSettings)) {
      if (!(key in DEFAULT_SETTINGS)) throw new AppError(400, `Unknown setting: ${key}`);
      let stored;
      if (BOOLEAN_KEYS.includes(key)) {
        stored = String(value === true || String(value).toLowerCase() === 'true');
      } else if (TEXT_KEYS.includes(key)) {
        stored = String(value ?? '').trim();
      } else {
        const n = num(value, key, { nonnegative: true });
        if (RATE_KEYS.includes(key) && n > 1) throw new AppError(400, `${key} must be between 0 and 1.`);
        stored = String(n);
      }
      await Setting.updateOne({ Key: key }, { $set: { Value: stored } }, { upsert: true, session });
    }
    await audit.log('SETTINGS_UPDATE', 'Settings', 'ERP', newSettings, session);
    return true;
  });
}

module.exports = { DEFAULT_SETTINGS, getSettings, updateSettings };
