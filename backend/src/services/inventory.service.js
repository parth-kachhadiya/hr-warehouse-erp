// Inventory ledger, physical quantity and warehouse utilization
// (same as appendInventoryMovementNoLock_, getInventoryLedger and getWarehouseUtilizationRaw_).
const { Asset, InventoryLedger } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { getSettings } = require('./settings.service');

const physicalQty = (a) => Math.max(0, (Number(a.QuantityAvailable) || 0) + (Number(a.QuantityReserved) || 0));

// Pass movementID when it was already taken with nextIds(), to save a database round trip.
async function recordMovement(assetID, sellerID, type, physical, available, reserved, delivered, removed, saleID, notes, when, session, movementID) {
  await new InventoryLedger({
    MovementID: movementID || (await nextId('MOV', session)),
    Timestamp: when || new Date(),
    AssetID: String(assetID || ''),
    SellerID: String(sellerID || ''),
    Type: type,
    PhysicalQtyDelta: Number(physical) || 0,
    AvailableQtyDelta: Number(available) || 0,
    ReservedQtyDelta: Number(reserved) || 0,
    DeliveredQtyDelta: Number(delivered) || 0,
    RemovedQtyDelta: Number(removed) || 0,
    SaleID: String(saleID || ''),
    Notes: String(notes || ''),
    Status: 'Active',
  }).save({ session });
}

async function getInventoryLedger(assetID) {
  const filter = { Status: { $ne: 'Void' } };
  if (assetID) filter.AssetID = assetID;
  return InventoryLedger.find(filter).sort({ Timestamp: 1, MovementID: 1 }).lean();
}

// Pass settings when the caller already has them. Used space is added up inside the
// database, so the product list is not downloaded on every save.
async function getWarehouseUtilization(session, knownSettings) {
  const settings = knownSettings || (await getSettings(session));
  const capacity = Number(settings.WarehouseCapacitySqFt) || 0;
  const rented = Number(settings.RentedFootprintSqFt) || capacity;
  const qty = (field) => ({ $convert: { input: `$${field}`, to: 'double', onError: 0, onNull: 0 } });
  const [totals = { used: 0, items: 0, skus: 0 }] = await Asset.aggregate([
    { $match: { Status: { $nin: ['Archived', 'Sold'] } } },
    { $project: { pq: { $max: [0, { $add: [qty('QuantityAvailable'), qty('QuantityReserved')] }] }, space: qty('SpaceSqFt') } },
    { $match: { pq: { $gt: 0 } } },
    { $group: { _id: null, used: { $sum: { $multiply: ['$space', '$pq'] } }, items: { $sum: '$pq' }, skus: { $sum: 1 } } },
  ]).session(session || null);
  const used = totals.used;
  return {
    capacity,
    rentedFootprint: rented,
    used,
    available: capacity - used,
    utilizationPct: capacity > 0 ? Math.round((used / capacity) * 1000) / 10 : 0,
    activeItemCount: totals.items,
    activeSkuCount: totals.skus,
    spaceEfficiencyMultiplier: rented > 0 ? Math.round((capacity / rented) * 100) / 100 : 1,
  };
}

module.exports = { physicalQty, recordMovement, getInventoryLedger, getWarehouseUtilization };
