// Monthly storage billing (same as runMonthlyStorageBilling in the old script:
// quantity-aware, prorated by day, and safe to run twice in a month).
// Per product with a seller:
//  1. Replay the inventory ledger to know how many units were in the warehouse at
//     every moment of this month (IST), up to now. units x days x sq.ft = space-days.
//  2. Subtract the space-days already billed this month.
//  3. Charge = round(new space-days / days in month x rate). It is deducted from the seller payable.
const { Asset, InventoryLedger, StorageLedger, Seller } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { monthKey, istMonthBounds, DAY_MS } = require('../utils/date');
const audit = require('./audit.service');
const { physicalQty } = require('./inventory.service');
const { getSettings } = require('./settings.service');

// storageSpaceDaysAccrued_
function spaceDaysAccrued(asset, moves, bounds, now) {
  const end = now < bounds.end ? now : bounds.end;
  if (end <= bounds.start) return 0;
  const unitSpace = Number(asset.SpaceSqFt) || 0;
  if (unitSpace <= 0) return 0;
  const list = moves.filter((m) => new Date(m.Timestamp) < end);

  let qty = 0;
  list.forEach((m) => { if (new Date(m.Timestamp) < bounds.start) qty += Number(m.PhysicalQtyDelta) || 0; });
  let cursor = bounds.start;
  let qtyDays = 0;
  list.forEach((m) => {
    const d = new Date(m.Timestamp);
    if (d < bounds.start || d >= end) return;
    qtyDays += Math.max(0, (d - cursor) / DAY_MS) * Math.max(0, qty);
    qty += Number(m.PhysicalQtyDelta) || 0;
    cursor = d;
  });
  qtyDays += Math.max(0, (end - cursor) / DAY_MS) * Math.max(0, qty);
  return qtyDays * unitSpace;
}

async function runMonthlyStorageBilling({ now = new Date() } = {}) {
  return withTransaction(async (session) => {
    const month = monthKey(now);
    const settings = await getSettings(session);
    const rate = Number.isFinite(settings.StorageRatePerSqFtPerMonth) ? settings.StorageRatePerSqFtPerMonth : 25;
    const { start, end, daysInMonth } = istMonthBounds(month);
    const bounds = { start, end };

    const assets = await Asset.find({ SellerID: { $nin: ['', null] } }).sort({ AssetID: 1 }).session(session).lean();
    const sellers = await Seller.find().session(session).lean();
    const sellersById = Object.fromEntries(sellers.map((s) => [s.SellerID, s]));
    const moves = await InventoryLedger.find({ AssetID: { $in: assets.map((a) => a.AssetID) }, Status: { $ne: 'Void' } })
      .sort({ Timestamp: 1, MovementID: 1 }).session(session).lean();
    const movesByAsset = {};
    moves.forEach((m) => { (movesByAsset[m.AssetID] ||= []).push(m); });
    const billedRows = await StorageLedger.find({ Month: month, Status: { $ne: 'Void' } }).session(session).lean();

    const bySeller = {};
    for (const a of assets) {
      const accrued = spaceDaysAccrued(a, movesByAsset[a.AssetID] || [], bounds, now);
      const billed = billedRows.filter((r) => r.AssetID === a.AssetID).reduce((t, r) => {
        const explicit = Number(r.SpaceDaysCharged);
        if (Number.isFinite(explicit) && explicit > 0) return t + explicit;
        return t + (Number(r.SpaceOccupiedSqFt) || 0) * (Number(r.DaysCharged) || 0);
      }, 0);
      const newSpaceDays = Math.max(0, accrued - billed);
      if (newSpaceDays < 0.0001) continue;
      const charge = Math.round((newSpaceDays / daysInMonth) * rate);
      if (charge <= 0) continue;

      const currentQty = physicalQty(a);
      const unitSpace = Number(a.SpaceSqFt) || 0;
      const sellerName = (sellersById[a.SellerID] || {}).Name || a.SellerName;
      await new StorageLedger({
        EntryID: await nextId('STG', session), Month: month, SellerID: a.SellerID, SellerName: sellerName,
        SpaceOccupiedSqFt: unitSpace * currentQty, RatePerSqFt: rate, Charge: charge, DateRun: new Date(),
        AssetID: a.AssetID, DaysCharged: unitSpace > 0 ? newSpaceDays / unitSpace : 0,
        Quantity: currentQty, UnitSpaceSqFt: unitSpace, SpaceDaysCharged: newSpaceDays, Status: 'Active',
      }).save({ session });

      if (!bySeller[a.SellerID]) bySeller[a.SellerID] = { sellerID: a.SellerID, sellerName, charge: 0 };
      bySeller[a.SellerID].charge += charge;
    }

    const results = [];
    for (const id of Object.keys(bySeller)) {
      await Seller.updateOne({ SellerID: id }, { $inc: { TotalPayable: -bySeller[id].charge } }, { session });
      results.push(bySeller[id]);
    }
    await audit.log('STORAGE_BILLING', 'Storage', month, {
      sellerCount: results.length, total: results.reduce((t, r) => t + r.charge, 0),
    }, session);
    return results;
  });
}

async function getStorageLedger() {
  return StorageLedger.find({ Status: { $ne: 'Void' } }).sort({ DateRun: -1, EntryID: -1 }).lean();
}

async function getSellerSpaceSummary() {
  const sellers = await Seller.find().sort({ SellerID: 1 }).lean();
  const assets = await Asset.find({ Status: { $ne: 'Archived' } }).lean();
  return sellers.map((s) => {
    const mine = assets.filter((a) => a.SellerID === s.SellerID && physicalQty(a) > 0);
    return {
      sellerID: s.SellerID,
      sellerName: s.Name,
      physicalQty: mine.reduce((t, a) => t + physicalQty(a), 0),
      spaceOccupied: mine.reduce((t, a) => t + (Number(a.SpaceSqFt) || 0) * physicalQty(a), 0),
    };
  }).filter((r) => r.spaceOccupied > 0);
}

module.exports = { runMonthlyStorageBilling, getStorageLedger, getSellerSpaceSummary, spaceDaysAccrued };
