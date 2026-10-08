// Same helpers as the old screen: fmt() for ₹ amounts, formatDateTime() in India Standard Time,
// statusClass() for badge colours.
export const fmt = (n) => { const v = Number(n) || 0; return `${v < 0 ? '-' : ''}₹${Math.abs(v).toLocaleString('en-IN')}`; };
export const statusClass = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
});
export function formatDateTime(value) {
  if (value === null || value === undefined || value === '') return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : dateTimeFmt.format(d);
}

export const safeUrl = (url) => {
  try {
    const u = new URL(String(url || ''));
    return ['http:', 'https:'].includes(u.protocol) ? u.href : '#';
  } catch {
    return '#';
  }
};
