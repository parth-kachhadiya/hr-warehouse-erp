// Dead stock report (same as getDeadStockReport in the old script).
const { Asset } = require('../models');
const { DAY_MS } = require('../utils/date');
const { physicalQty } = require('./inventory.service');

function bucketFor(days) {
  if (days >= 180) return ['180+ days', 'Seller exit / disposal'];
  if (days >= 90) return ['90-179 days', 'Liquidation / auction'];
  if (days >= 60) return ['60-89 days', 'Bundle / discount'];
  if (days >= 30) return ['30-59 days', 'Reprice'];
  return ['< 30 days', 'Monitor'];
}

async function getDeadStockReport(now = new Date()) {
  const assets = await Asset.find({ Status: { $nin: ['Archived', 'Sold'] } }).lean();
  return assets
    .filter((a) => physicalQty(a) > 0)
    .map((a) => {
      const d = a.DateReceived ? new Date(a.DateReceived) : null;
      const days = d ? Math.max(0, Math.floor((now - d) / DAY_MS)) : 0;
      const [agingBucket, suggestedAction] = bucketFor(days);
      return { ...a, daysInStock: days, agingBucket, suggestedAction };
    })
    .sort((x, y) => y.daysInStock - x.daysInStock);
}

module.exports = { getDeadStockReport, bucketFor };
