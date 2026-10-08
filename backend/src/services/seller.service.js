// Sellers (same rules as getSellers / addSeller / updateSeller / deleteSeller in the old script).
const { Seller, Asset, Sale } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { text } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');

async function listSellers() {
  return Seller.find({ Active: true }).sort({ SellerID: 1 }).lean();
}

async function createSeller(input = {}) {
  return withTransaction(async (session) => {
    if (!text(input.name)) throw new AppError(400, 'Seller name required.');
    const SellerID = await nextId('SEL', session);
    await new Seller({
      SellerID,
      Name: text(input.name),
      Phone: text(input.phone),
      Email: text(input.email),
      Address: text(input.address),
      GSTIN: text(input.gstin),
      KYCStatus: text(input.kycStatus) || 'Pending',
      JoinDate: new Date(),
      TotalPayable: 0,
      TotalSettled: 0,
      Active: true,
    }).save({ session });
    await audit.log('SELLER_ADD', 'Seller', SellerID, { name: text(input.name) }, session);
    return SellerID;
  });
}

async function updateSeller(sellerId, input = {}) {
  return withTransaction(async (session) => {
    const seller = await Seller.findOne({ SellerID: sellerId }).session(session);
    if (!seller) throw new AppError(404, 'Seller not found.');
    Object.assign(seller, {
      Name: text(input.name),
      Phone: text(input.phone),
      Email: text(input.email),
      Address: text(input.address),
      GSTIN: text(input.gstin),
      KYCStatus: text(input.kycStatus) || 'Pending',
    });
    await seller.save({ session });
    await audit.log('SELLER_UPDATE', 'Seller', sellerId, {}, session);
    return true;
  });
}

async function deleteSeller(sellerId) {
  return withTransaction(async (session) => {
    const seller = await Seller.findOne({ SellerID: sellerId }).session(session);
    if (!seller) throw new AppError(404, 'Seller not found.');
    const hasAssets = await Asset.exists({ SellerID: sellerId, Status: { $ne: 'Archived' } }).session(session);
    const assetIds = await Asset.distinct('AssetID', { SellerID: sellerId }).session(session);
    const hasSales = assetIds.length ? await Sale.exists({ AssetID: { $in: assetIds } }).session(session) : null;
    if (hasAssets || hasSales) throw new AppError(400, 'Seller has linked history. Archive seller only after all active stock is cleared.');
    seller.Active = false;
    seller.ArchivedAt = new Date();
    await seller.save({ session });
    await audit.log('SELLER_ARCHIVE', 'Seller', sellerId, {}, session);
    return true;
  });
}

module.exports = { listSellers, createSeller, updateSeller, deleteSeller };
