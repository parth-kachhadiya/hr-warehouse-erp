// Products: intake, stock list, edit, adjust quantity, archive and status change.
const { Asset, Seller } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { toNumber, round2 } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');
const inventory = require('./inventory.service');
const { getSettings } = require('./settings.service');

const text = (v) => String(v ?? '').trim();
const GRADES = ['A', 'B', 'C', 'D', 'E'];
const MANUAL_STATUSES = ['In Stock', 'Listed', 'Damaged'];

function readPrice(value, label) {
  const n = toNumber(value, 0);
  if (!Number.isFinite(n) || n < 0) throw new AppError(400, `${label} must be 0 or more`);
  return round2(n);
}

function readCustomFields(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { throw new AppError(400, 'Custom fields data is not valid'); }
  }
  return typeof value === 'object' ? value : {};
}

async function listAssets({ status, search } = {}) {
  const filter = {};
  if (status) filter.Status = status;
  if (search) {
    const rx = new RegExp(text(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ AssetID: rx }, { ItemName: rx }, { SellerName: rx }, { Category: rx }];
  }
  return Asset.find(filter).sort({ AssetID: -1 }).lean();
}

async function getAsset(assetId) {
  const asset = await Asset.findOne({ AssetID: assetId }).lean();
  if (!asset) throw new AppError(404, 'Product not found');
  return asset;
}

// INTAKE (old addAsset)
async function addAsset(input) {
  const ItemName = text(input.ItemName);
  const qty = toNumber(input.QuantityReceived, NaN);
  const space = toNumber(input.SpaceSqFt, NaN);
  if (!ItemName) throw new AppError(400, 'Item name is required');
  if (!Number.isInteger(qty) || qty < 1) throw new AppError(400, 'Quantity must be a whole number of 1 or more');
  if (!Number.isFinite(space) || space <= 0) throw new AppError(400, 'Space per unit (sq.ft) must be more than 0');
  const grade = text(input.ConditionGrade).toUpperCase() || 'C';
  if (!GRADES.includes(grade)) throw new AppError(400, 'Condition grade must be A, B, C, D or E');
  const ReservePrice = readPrice(input.ReservePrice, 'Reserve price');
  const ListedPrice = readPrice(input.ListedPrice, 'Listed price');

  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    let SellerName = '';
    const SellerID = text(input.SellerID);
    if (SellerID) {
      const seller = await Seller.findOne({ SellerID }).session(session);
      if (!seller) throw new AppError(404, 'Seller not found');
      if (!seller.Active) throw new AppError(400, 'Seller is archived. Choose an active seller.');
      SellerName = seller.Name;
    }
    await inventory.assertCapacity(space * qty, settings, session);

    const AssetID = await nextId('AST', session);
    const asset = await new Asset({
      AssetID,
      ItemName,
      Category: text(input.Category),
      SellerID,
      SellerName,
      DateReceived: new Date(),
      ConditionGrade: grade,
      QuantityReceived: qty,
      QuantityAvailable: qty,
      QuantityReserved: 0,
      QuantityDelivered: 0,
      QuantityRemoved: 0,
      SpaceSqFt: space,
      ReservePrice,
      ListedPrice,
      Status: 'In Stock',
      Notes: text(input.Notes),
      CustomFieldsData: readCustomFields(input.CustomFieldsData),
    }).save({ session });

    await inventory.recordMovement({ asset, type: 'RECEIPT', physical: qty, available: qty, notes: 'Intake' }, session);
    await audit.log('ADD_ASSET', 'Asset', AssetID, { ItemName, SellerID, Quantity: qty, SpaceSqFt: space }, session);
    return asset.toObject();
  });
}

// Edit product details (not allowed once Sold).
async function updateAsset(assetId, input) {
  return withTransaction(async (session) => {
    const asset = await Asset.findOne({ AssetID: assetId }).session(session);
    if (!asset) throw new AppError(404, 'Product not found');
    if (asset.Status === 'Sold') throw new AppError(400, 'Sold products cannot be edited');
    const changes = {};
    if (input.ItemName !== undefined) {
      changes.ItemName = text(input.ItemName);
      if (!changes.ItemName) throw new AppError(400, 'Item name is required');
    }
    if (input.Category !== undefined) changes.Category = text(input.Category);
    if (input.ConditionGrade !== undefined) {
      changes.ConditionGrade = text(input.ConditionGrade).toUpperCase();
      if (!GRADES.includes(changes.ConditionGrade)) throw new AppError(400, 'Condition grade must be A, B, C, D or E');
    }
    if (input.ReservePrice !== undefined) changes.ReservePrice = readPrice(input.ReservePrice, 'Reserve price');
    if (input.ListedPrice !== undefined) changes.ListedPrice = readPrice(input.ListedPrice, 'Listed price');
    if (input.Notes !== undefined) changes.Notes = text(input.Notes);
    if (input.CustomFieldsData !== undefined) changes.CustomFieldsData = readCustomFields(input.CustomFieldsData);
    Object.assign(asset, changes);
    if (changes.CustomFieldsData) asset.markModified('CustomFieldsData');
    await asset.save({ session });
    await audit.log('UPDATE_ASSET', 'Asset', assetId, changes, session);
    return asset.toObject();
  });
}

// Adjust Quantity: set a new total received quantity, with a reason.
async function adjustQuantity(assetId, input) {
  const newQty = toNumber(input.newQuantity, NaN);
  const reason = text(input.reason);
  if (!Number.isInteger(newQty) || newQty < 0) throw new AppError(400, 'New quantity must be a whole number of 0 or more');
  if (!reason) throw new AppError(400, 'A reason is required to adjust quantity');

  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    const asset = await Asset.findOne({ AssetID: assetId }).session(session);
    if (!asset) throw new AppError(404, 'Product not found');
    if (['Archived', 'Sold'].includes(asset.Status)) throw new AppError(400, `Cannot adjust a ${asset.Status} product`);
    const locked = asset.QuantityReserved + asset.QuantityDelivered + asset.QuantityRemoved;
    if (newQty < locked) {
      throw new AppError(400, `New quantity cannot be below ${locked} (reserved + delivered + removed).`);
    }
    const delta = newQty - asset.QuantityReceived;
    if (delta === 0) throw new AppError(400, 'Quantity is unchanged');
    if (delta > 0) await inventory.assertCapacity(asset.SpaceSqFt * delta, settings, session);

    const before = asset.QuantityReceived;
    asset.QuantityReceived = newQty;
    asset.QuantityAvailable += delta;
    await asset.save({ session });
    await inventory.recordMovement({ asset, type: 'ADJUST', physical: delta, available: delta, notes: reason }, session);
    await audit.log('ADJUST_QUANTITY', 'Asset', assetId, { from: before, to: newQty, reason }, session);
    return asset.toObject();
  });
}

// Archive: remaining available units are moved to Removed.
async function archiveAsset(assetId, input = {}) {
  return withTransaction(async (session) => {
    const asset = await Asset.findOne({ AssetID: assetId }).session(session);
    if (!asset) throw new AppError(404, 'Product not found');
    if (asset.Status === 'Archived') throw new AppError(400, 'Product is already archived');
    if (asset.QuantityReserved > 0) throw new AppError(400, 'Cannot archive while units are reserved for a sale');
    const units = asset.QuantityAvailable;
    asset.QuantityRemoved += units;
    asset.QuantityAvailable = 0;
    asset.Status = 'Archived';
    asset.ArchivedAt = new Date();
    await asset.save({ session });
    if (units > 0) {
      await inventory.recordMovement(
        { asset, type: 'REMOVE', physical: -units, available: -units, removed: units, notes: text(input.reason) || 'Archived' },
        session
      );
    }
    await audit.log('ARCHIVE_ASSET', 'Asset', assetId, { unitsRemoved: units, reason: text(input.reason) }, session);
    return asset.toObject();
  });
}

// Change Status dropdown: In Stock / Listed / Damaged only.
async function changeStatus(assetId, input) {
  const status = text(input.Status);
  if (!MANUAL_STATUSES.includes(status)) throw new AppError(400, 'Status must be In Stock, Listed or Damaged');
  return withTransaction(async (session) => {
    const asset = await Asset.findOne({ AssetID: assetId }).session(session);
    if (!asset) throw new AppError(404, 'Product not found');
    if (['Sold', 'Archived'].includes(asset.Status)) throw new AppError(400, `${asset.Status} products cannot change status`);
    if (status === 'Damaged' && asset.QuantityReserved > 0) throw new AppError(400, 'Cannot mark Damaged while units are reserved');
    const from = asset.Status;
    asset.Status = status;
    await asset.save({ session });
    await audit.log('CHANGE_STATUS', 'Asset', assetId, { from, to: status }, session);
    return asset.toObject();
  });
}

async function getWarehouseSpace() {
  const settings = await getSettings();
  const used = await inventory.getUsedSpace();
  return {
    capacity: settings.WarehouseCapacitySqFt,
    used,
    free: round2(settings.WarehouseCapacitySqFt - used),
    utilization: settings.WarehouseCapacitySqFt ? round2((used / settings.WarehouseCapacitySqFt) * 100) : 0,
  };
}

module.exports = { listAssets, getAsset, addAsset, updateAsset, adjustQuantity, archiveAsset, changeStatus, getWarehouseSpace };
