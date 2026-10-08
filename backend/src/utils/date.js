// India Standard Time helpers. Dates are stored in UTC; months and days are worked out in IST.
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function istParts(date = new Date()) {
  const d = new Date(date.getTime() + IST_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// "2026-10" style month key for a date, in IST.
function monthKey(date = new Date()) {
  const { year, month } = istParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Start and end (exclusive) of an IST month, plus how many days it has.
function istMonthBounds(key) {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS);
  const end = new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, end, daysInMonth };
}

module.exports = { IST_OFFSET_MS, DAY_MS, istParts, monthKey, istMonthBounds };
