// Money in ₹ (Indian grouping) and dates in India Standard Time.
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export const formatINR = (n) => inr.format(Number(n) || 0);
export const formatNumber = (n) => num.format(Number(n) || 0);
export const formatPercent = (rate) => `${num.format((Number(rate) || 0) * 100)}%`;
export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : '-');
export const formatDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '-');

// Today's date as yyyy-mm-dd in IST, for date inputs.
export const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

// "2026-10" for the current IST month.
export const currentMonthIST = () => todayIST().slice(0, 7);
