// Small helpers for reading numbers from forms and keeping money at 2 decimals.
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

module.exports = { round2, toNumber };
