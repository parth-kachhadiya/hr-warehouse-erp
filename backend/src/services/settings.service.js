// Reads and writes the key/value Settings, turning text into numbers and true/false.
const { Setting } = require('../models');
const AppError = require('../utils/AppError');

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
  ERPVersion: '2.4',
};

const BOOLEAN_KEYS = ['RequireReservePriceApproval', 'EnforceWarehouseCapacity'];
const TEXT_KEYS = ['MediaRootFolderId', 'ERPVersion'];
const RATE_KEYS = ['CommissionTier1Rate', 'CommissionTier2Rate', 'CommissionTier3Rate'];
const READ_ONLY_KEYS = ['ERPVersion'];

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

async function updateSettings(updates, session) {
  const changed = {};
  for (const [key, value] of Object.entries(updates || {})) {
    if (!(key in DEFAULT_SETTINGS)) throw new AppError(400, `Unknown setting: ${key}`);
    if (READ_ONLY_KEYS.includes(key)) continue;
    let text;
    if (BOOLEAN_KEYS.includes(key)) {
      text = String(value === true || String(value).toLowerCase() === 'true');
    } else if (TEXT_KEYS.includes(key)) {
      text = String(value ?? '').trim();
    } else {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new AppError(400, `${key} must be a number of 0 or more`);
      if (RATE_KEYS.includes(key) && n > 1) throw new AppError(400, `${key} must be a rate between 0 and 1 (10% = 0.10)`);
      text = String(n);
    }
    await Setting.updateOne({ Key: key }, { $set: { Value: text } }, { upsert: true, session });
    changed[key] = text;
  }
  return changed;
}

module.exports = { DEFAULT_SETTINGS, getSettings, updateSettings };
