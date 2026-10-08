// Inventory ledger, physical quantity and warehouse utilization
// (same as appendInventoryMovementNoLock_, getInventoryLedger and getWarehouseUtilizationRaw_).
const { Asset, InventoryLedger } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { getSettings } = require('./settings.service');

const physicalQty = (a) => Math.max(0, (Number(a.QuantityAvailable) || 0) + (Number(a.QuantityReserved) || 0));

async function recordMovement(assetID, sellerID, type, physical, available, reserved, delivered, removed, saleID, notes, when, session) {
  await new InventoryLedger({
    MovementID: await nextId('MOV', session),
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

async function getWarehouseUtilization(session) {
  const settings = await getSettings(session);
  const capacity = Number(settings.WarehouseCapacitySqFt) || 0;
  const rented = Number(settings.RentedFootprintSqFt) || capacity;
  const assets = await Asset.find({ Status: { $nin: ['Archived', 'Sold'] } }).session(session || null).lean();
  const active = assets.filter((a) => physicalQty(a) > 0);
  const used = active.reduce((t, a) => t + (Number(a.SpaceSqFt) || 0) * physicalQty(a), 0);
  return {
    capacity,
    rentedFootprint: rented,
    used,
    available: capacity - used,
    utilizationPct: capacity > 0 ? Math.round((used / capacity) * 1000) / 10 : 0,
    activeItemCount: active.reduce((t, a) => t + physicalQty(a), 0),
    activeSkuCount: active.length,
    spaceEfficiencyMultiplier: rented > 0 ? Math.round((capacity / rented) * 100) / 100 : 1,
  };
}

module.exports = { physicalQty, recordMovement, getInventoryLedger, getWarehouseUtilization };
