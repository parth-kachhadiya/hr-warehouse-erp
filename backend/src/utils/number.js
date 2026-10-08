// Small helpers for reading numbers and text from forms (same rules as num_ / text_ in the old script).
const AppError = require('./AppError');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

// Same as num_(v, label, options) in the Apps Script version.
function num(value, label = 'Value', options = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new AppError(400, `${label} must be a valid number.`);
  if (options.positive && n <= 0) throw new AppError(400, `${label} must be greater than 0.`);
  if (options.nonnegative && n < 0) throw new AppError(400, `${label} cannot be negative.`);
  return n;
}

const text = (v) => String(v === undefined || v === null ? '' : v).trim();

module.exports = { round2, toNumber, num, text };
