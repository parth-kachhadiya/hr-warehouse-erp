// Quantity buckets, the inventory ledger, and the warehouse capacity check.
const { Asset, InventoryLedger } = require('../models');
const { nextId } = require('../utils/idGenerator');
const AppError = require('../utils/AppError');
const { round2 } = require('../utils/number');

// Writes one stock movement row.
async function recordMovement({ asset, type, physical = 0, available = 0, reserved = 0, delivered = 0, removed = 0, saleId = '', notes = '' }, session) {
  const MovementID = await nextId('MOV', session);
  await new InventoryLedger({
    MovementID,
    Timestamp: new Date(),
    AssetID: asset.AssetID,
    SellerID: asset.SellerID || '',
    Type: type,
    PhysicalQtyDelta: physical,
    AvailableQtyDelta: available,
    ReservedQtyDelta: reserved,
    DeliveredQtyDelta: delivered,
    RemovedQtyDelta: removed,
    SaleID: saleId,
    Notes: notes,
    Status: 'Active',
  }).save({ session });
  return MovementID;
}

// Used space = sum of SpaceSqFt x (Available + Reserved) for products not Archived or Sold.
async function getUsedSpace(session, match = {}) {
  const [row] = await Asset.aggregate([
    { $match: { Status: { $nin: ['Archived', 'Sold'] }, ...match } },
    { $group: { _id: null, used: { $sum: { $multiply: ['$SpaceSqFt', { $add: ['$QuantityAvailable', '$QuantityReserved'] }] } } } },
  ]).session(session || null);
  return round2(row ? row.used : 0);
}

// Blocks intake/increase when it would go over the warehouse capacity (if enforced).
async function assertCapacity(extraSqFt, settings, session) {
  if (!settings.EnforceWarehouseCapacity || extraSqFt <= 0) return;
  const used = await getUsedSpace(session);
  const capacity = settings.WarehouseCapacitySqFt;
  if (used + extraSqFt > capacity) {
    throw new AppError(
      400,
      `Warehouse capacity exceeded. Used ${used} sq.ft + new ${round2(extraSqFt)} sq.ft is more than capacity ${capacity} sq.ft.`
    );
  }
}

// When nothing is left in the warehouse, the product becomes Sold (or Archived if some were removed).
function finaliseIfEmpty(asset) {
  if (
    asset.QuantityAvailable === 0 &&
    asset.QuantityReserved === 0 &&
    asset.QuantityDelivered + asset.QuantityRemoved >= asset.QuantityReceived
  ) {
    asset.Status = asset.QuantityRemoved > 0 ? 'Archived' : 'Sold';
    asset.DateSold = new Date();
    if (asset.Status === 'Archived' && !asset.ArchivedAt) asset.ArchivedAt = new Date();
  }
}

async function listMovements(assetId) {
  return InventoryLedger.find({ AssetID: assetId }).sort({ Timestamp: 1, MovementID: 1 }).lean();
}

module.exports = { recordMovement, getUsedSpace, assertCapacity, finaliseIfEmpty, listMovements };
