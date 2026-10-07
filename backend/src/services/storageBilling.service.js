// Monthly storage rent. Rent is DEDUCTED from the seller's payable (not billed separately).
//
// How it works, per product with a seller:
//  1. Replay the inventory ledger to know how many units were physically in the
//     warehouse at every moment of this month (IST), up to now.
//  2. units x days x space-per-unit = "space-days" used so far this month.
//  3. Subtract space-days already billed this month (so running twice never double-bills).
//  4. Charge = round(new space-days / days in month x rate per sq.ft per month).
const { Asset, InventoryLedger, StorageLedger, Seller } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { monthKey, istMonthBounds, daysBetween } = require('../utils/date');
const { round2 } = require('../utils/number');
const audit = require('./audit.service');
const { getSettings } = require('./settings.service');

const round4 = (n) => Math.round(n * 10000) / 10000;

// Unit-days in the window [start, until) from a sorted list of movements.
function unitDaysInWindow(moves, start, until) {
  let qty = 0;
  let cursor = start;
  let unitDays = 0;
  for (const m of moves) {
    const t = new Date(m.Timestamp);
    if (t >= until) break;
    if (t <= start) {
      qty += m.PhysicalQtyDelta;
      continue;
    }
    unitDays += qty * daysBetween(cursor, t);
    cursor = t;
    qty += m.PhysicalQtyDelta;
  }
  if (until > cursor) unitDays += qty * daysBetween(cursor, until);
  return { unitDays, currentQty: qty };
}

async function runMonthlyStorageBilling({ now = new Date() } = {}) {
  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    const rate = settings.StorageRatePerSqFtPerMonth;
    const Month = monthKey(now);
    const { start, end, daysInMonth } = istMonthBounds(Month);
    const until = now < end ? now : end;

    const assets = await Asset.find({ SellerID: { $nin: ['', null] } }).session(session).lean();
    const ids = assets.map((a) => a.AssetID);
    const moves = await InventoryLedger.find({ AssetID: { $in: ids }, Status: 'Active', Timestamp: { $lt: until } })
      .sort({ Timestamp: 1, MovementID: 1 })
      .session(session)
      .lean();
    const movesByAsset = {};
    moves.forEach((m) => { (movesByAsset[m.AssetID] ||= []).push(m); });

    const billedRows = await StorageLedger.aggregate([
      { $match: { Month, Status: 'Active', AssetID: { $in: ids } } },
      { $group: { _id: '$AssetID', spaceDays: { $sum: '$SpaceDaysCharged' } } },
    ]).session(session);
    const billed = Object.fromEntries(billedRows.map((r) => [r._id, r.spaceDays]));

    const entries = [];
    const bySeller = {};
    for (const asset of assets) {
      const { unitDays, currentQty } = unitDaysInWindow(movesByAsset[asset.AssetID] || [], start, until);
      const accrued = unitDays * asset.SpaceSqFt;
      const newSpaceDays = round4(accrued - (billed[asset.AssetID] || 0));
      if (newSpaceDays <= 0) continue;
      const Charge = Math.round((newSpaceDays / daysInMonth) * rate);
      if (Charge <= 0) continue; // tiny amounts wait for the next run

      const entry = await new StorageLedger({
        EntryID: await nextId('STG', session),
        Month,
        SellerID: asset.SellerID,
        SellerName: asset.SellerName,
        SpaceOccupiedSqFt: round2(currentQty * asset.SpaceSqFt),
        RatePerSqFt: rate,
        Charge,
        DateRun: new Date(),
        AssetID: asset.AssetID,
        DaysCharged: round2(newSpaceDays / (asset.SpaceSqFt * Math.max(currentQty, 1))),
        Quantity: currentQty,
        UnitSpaceSqFt: asset.SpaceSqFt,
        SpaceDaysCharged: newSpaceDays,
        Status: 'Active',
      }).save({ session });
      entries.push(entry.toObject());
      bySeller[asset.SellerID] = (bySeller[asset.SellerID] || 0) + Charge;
    }

    for (const [SellerID, total] of Object.entries(bySeller)) {
      await Seller.updateOne({ SellerID }, { $inc: { TotalPayable: -total } }, { session });
    }

    const totalCharge = entries.reduce((s, e) => s + e.Charge, 0);
    await audit.log('RUN_STORAGE_BILLING', 'StorageLedger', Month, { entries: entries.length, totalCharge, bySeller }, session);
    return { Month, entries, totalCharge, bySeller, daysInMonth, rate };
  });
}

async function listStorageLedger({ month } = {}) {
  return StorageLedger.find(month ? { Month: month } : {}).sort({ EntryID: -1 }).lean();
}

// Space each seller is using right now.
async function sellerSpaceSummary() {
  const rows = await Asset.aggregate([
    { $match: { Status: { $nin: ['Archived', 'Sold'] }, SellerID: { $nin: ['', null] } } },
    {
      $group: {
        _id: '$SellerID',
        SellerName: { $first: '$SellerName' },
        Products: { $sum: 1 },
        Units: { $sum: { $add: ['$QuantityAvailable', '$QuantityReserved'] } },
        SpaceSqFt: { $sum: { $multiply: ['$SpaceSqFt', { $add: ['$QuantityAvailable', '$QuantityReserved'] }] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ SellerID: r._id, SellerName: r.SellerName, Products: r.Products, Units: r.Units, SpaceSqFt: round2(r.SpaceSqFt) }));
}

module.exports = { runMonthlyStorageBilling, listStorageLedger, sellerSpaceSummary, unitDaysInWindow };
