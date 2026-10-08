// Products (same rules as getAssets / addAsset / updateAsset / adjustAssetQuantity /
// setAssetStatus / deleteAsset in the old script).
const { Asset, Seller } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { num, text } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');
const inventory = require('./inventory.service');
const { getSettings } = require('./settings.service');

const ALLOWED_ASSET_STATUSES = ['In Stock', 'Listed', 'On Hold', 'Damaged', 'Archived', 'Sold'];

async function getAssets() {
  return Asset.find({ Status: { $ne: 'Archived' } }).sort({ AssetID: 1 }).lean();
}

async function addAsset(a = {}) {
  return withTransaction(async (session) => {
    if (!text(a.itemName)) throw new AppError(400, 'Item name required.');
    const qty = Math.floor(num(a.quantity, 'Quantity', { positive: true }));
    if (qty < 1) throw new AppError(400, 'Quantity must be at least 1.');
    const unitSpace = num(a.spaceSqFt, 'Space per unit', { positive: true });
    const reserve = a.reservePrice === '' || a.reservePrice == null ? 0 : num(a.reservePrice, 'Reserve price per unit', { nonnegative: true });
    const listed = a.listedPrice === '' || a.listedPrice == null ? 0 : num(a.listedPrice, 'Listed price per unit', { nonnegative: true });

    let sellerName = '';
    if (a.sellerID) {
      const seller = await Seller.findOne({ SellerID: a.sellerID, Active: true }).session(session);
      if (!seller) throw new AppError(400, 'Selected seller is not active.');
      sellerName = seller.Name;
    }

    const requiredSpace = unitSpace * qty;
    const settings = await getSettings(session);
    if (settings.EnforceWarehouseCapacity) {
      const wh = await inventory.getWarehouseUtilization(session);
      if (wh.capacity > 0 && wh.used + requiredSpace > wh.capacity) {
        throw new AppError(400, `Warehouse capacity exceeded. Available: ${wh.available} sq.ft, required: ${requiredSpace} sq.ft for ${qty} unit(s).`);
      }
    }

    const id = await nextId('AST', session);
    await new Asset({
      AssetID: id,
      ItemName: text(a.itemName),
      Category: text(a.category),
      SellerID: text(a.sellerID),
      SellerName: sellerName,
      DateReceived: new Date(),
      ConditionGrade: text(a.conditionGrade) || 'C',
      QuantityReceived: qty,
      QuantityAvailable: qty,
      QuantityReserved: 0,
      QuantityDelivered: 0,
      QuantityRemoved: 0,
      SpaceSqFt: unitSpace,
      ReservePrice: reserve,
      ListedPrice: listed,
      Status: 'In Stock',
      Notes: text(a.notes),
      CustomFieldsData: a.customFields && typeof a.customFields === 'object' ? a.customFields : {},
    }).save({ session });
    await inventory.recordMovement(id, text(a.sellerID), 'RECEIPT', qty, qty, 0, 0, 0, '', 'Product intake', null, session);
    await audit.log('ASSET_ADD', 'Asset', id, {
      item: text(a.itemName), sellerID: text(a.sellerID), quantity: qty, unitSpace, totalSpace: requiredSpace,
    }, session);
    return id;
  });
}

async function updateAsset(assetID, a = {}) {
  return withTransaction(async (session) => {
    const asset = await Asset.findOne({ AssetID: assetID }).session(session);
    if (!asset) throw new AppError(404, 'Asset not found.');
    if (asset.Status === 'Sold') throw new AppError(400, 'Fully sold product cannot be edited.');
    const fields = {};
    if (a.itemName !== undefined) fields.ItemName = text(a.itemName);
    if (a.category !== undefined) fields.Category = text(a.category);
    if (a.conditionGrade !== undefined) fields.ConditionGrade = text(a.conditionGrade) || 'C';
    if (a.spaceSqFt !== undefined) fields.SpaceSqFt = num(a.spaceSqFt, 'Space per unit', { positive: true });
    if (a.reservePrice !== undefined) fields.ReservePrice = num(a.reservePrice, 'Reserve price per unit', { nonnegative: true });
    if (a.listedPrice !== undefined) fields.ListedPrice = num(a.listedPrice, 'Listed price per unit', { nonnegative: true });
    if (a.notes !== undefined) fields.Notes = text(a.notes);
    Object.assign(asset, fields);
    await asset.save({ session });
    await audit.log('ASSET_UPDATE', 'Asset', assetID, fields, session);
    return true;
  });
}

async function adjustAssetQuantity(assetID, newTotalQty, reasonInput) {
  return withTransaction(async (session) => {
    const reason = text(reasonInput);
    if (!reason) throw new AppError(400, 'Reason is required.');
    const a = await Asset.findOne({ AssetID: assetID }).session(session);
    if (!a) throw new AppError(404, 'Asset not found.');
    const newQty = Math.floor(num(newTotalQty, 'New total quantity', { positive: true }));
    const oldQty = Math.floor(Number(a.QuantityReceived) || 0);
    const minQty = Math.floor(a.QuantityReserved || 0) + Math.floor(a.QuantityDelivered || 0) + Math.floor(a.QuantityRemoved || 0);
    if (newQty < minQty) throw new AppError(400, `Cannot reduce total quantity below committed quantity ${minQty}.`);
    const delta = newQty - oldQty;
    if (delta === 0) return true;

    const oldAvail = Math.floor(Number(a.QuantityAvailable) || 0);
    if (delta < 0 && oldAvail < Math.abs(delta)) throw new AppError(400, 'Not enough available quantity to reduce.');

    if (delta > 0 && (await getSettings(session)).EnforceWarehouseCapacity) {
      const wh = await inventory.getWarehouseUtilization(session);
      const extra = (Number(a.SpaceSqFt) || 0) * delta;
      if (wh.capacity > 0 && wh.used + extra > wh.capacity) throw new AppError(400, 'Warehouse capacity exceeded by quantity adjustment.');
    }

    a.QuantityReceived = newQty;
    a.QuantityAvailable = oldAvail + delta;
    a.Status = 'In Stock';
    await a.save({ session });
    await inventory.recordMovement(assetID, a.SellerID, 'ADJUST', delta, delta, 0, 0, 0, '', reason, null, session);
    await audit.log('QTY_ADJUST', 'Asset', assetID, { oldQty, newQty, delta, reason }, session);
    return true;
  });
}

async function setAssetStatus(assetID, statusInput) {
  return withTransaction(async (session) => {
    const status = text(statusInput);
    if (!ALLOWED_ASSET_STATUSES.includes(status)) throw new AppError(400, 'Invalid asset status.');
    if (status === 'Sold') throw new AppError(400, 'Sold status is automatic when all units are delivered.');
    if (status === 'Archived') throw new AppError(400, 'Use Archive action.');
    if (status === 'On Hold') throw new AppError(400, 'Reservation is tracked by Reserved Qty, not whole-product status.');
    const a = await Asset.findOne({ AssetID: assetID }).session(session);
    if (!a) throw new AppError(404, 'Asset not found.');
    if (Number(a.QuantityReserved) > 0 && status === 'Damaged') {
      throw new AppError(400, `Cannot mark product Damaged while ${a.QuantityReserved} unit(s) are reserved.`);
    }
    a.Status = status;
    await a.save({ session });
    await audit.log('ASSET_STATUS', 'Asset', assetID, { status }, session);
    return true;
  });
}

// Archive: remaining available units are moved to Removed.
async function deleteAsset(assetID) {
  return withTransaction(async (session) => {
    const a = await Asset.findOne({ AssetID: assetID }).session(session);
    if (!a) throw new AppError(404, 'Asset not found.');
    const reserved = Math.floor(Number(a.QuantityReserved) || 0);
    if (reserved > 0) throw new AppError(400, `Cannot archive while ${reserved} unit(s) are reserved in active orders.`);
    const available = Math.floor(Number(a.QuantityAvailable) || 0);
    if (available > 0) {
      await inventory.recordMovement(assetID, a.SellerID, 'REMOVE', -available, -available, 0, 0, available, '', 'Archived / removed from warehouse', null, session);
    }
    a.QuantityAvailable = 0;
    a.QuantityRemoved = (Number(a.QuantityRemoved) || 0) + available;
    a.Status = 'Archived';
    a.ArchivedAt = new Date();
    await a.save({ session });
    await audit.log('ASSET_ARCHIVE', 'Asset', assetID, { removedQty: available }, session);
    return true;
  });
}

module.exports = { getAssets, addAsset, updateAsset, adjustAssetQuantity, setAssetStatus, deleteAsset };
