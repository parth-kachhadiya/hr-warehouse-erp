// Sellers: people who store goods in the warehouse. Soft delete only (Active=false).
const { Seller, Asset } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');

const text = (v) => String(v ?? '').trim();
const EDITABLE = ['Name', 'Phone', 'Email', 'Address', 'GSTIN', 'KYCStatus'];

async function listSellers({ includeArchived = false } = {}) {
  const filter = includeArchived ? {} : { Active: true };
  return Seller.find(filter).sort({ SellerID: 1 }).lean();
}

async function createSeller(input) {
  const Name = text(input.Name);
  if (!Name) throw new AppError(400, 'Seller name is required');
  return withTransaction(async (session) => {
    const SellerID = await nextId('SEL', session);
    const seller = await new Seller({
      SellerID,
      Name,
      Phone: text(input.Phone),
      Email: text(input.Email),
      Address: text(input.Address),
      GSTIN: text(input.GSTIN),
      KYCStatus: text(input.KYCStatus) || 'Pending',
      JoinDate: new Date(),
    }).save({ session });
    await audit.log('CREATE_SELLER', 'Seller', SellerID, { Name }, session);
    return seller.toObject();
  });
}

async function updateSeller(sellerId, input) {
  return withTransaction(async (session) => {
    const seller = await Seller.findOne({ SellerID: sellerId }).session(session);
    if (!seller) throw new AppError(404, 'Seller not found');
    const changes = {};
    EDITABLE.forEach((key) => {
      if (input[key] !== undefined) changes[key] = text(input[key]);
    });
    if ('Name' in changes && !changes.Name) throw new AppError(400, 'Seller name is required');
    Object.assign(seller, changes);
    await seller.save({ session });
    // Keep the copied seller name on products in step.
    if (changes.Name) await Asset.updateMany({ SellerID: sellerId }, { $set: { SellerName: changes.Name } }, { session });
    await audit.log('UPDATE_SELLER', 'Seller', sellerId, changes, session);
    return seller.toObject();
  });
}

async function archiveSeller(sellerId) {
  return withTransaction(async (session) => {
    const seller = await Seller.findOne({ SellerID: sellerId }).session(session);
    if (!seller) throw new AppError(404, 'Seller not found');
    if (!seller.Active) throw new AppError(400, 'Seller is already archived');
    const linked = await Asset.countDocuments({ SellerID: sellerId }).session(session);
    if (linked > 0) throw new AppError(400, `Cannot archive: seller has ${linked} linked product(s) and their sales.`);
    seller.Active = false;
    seller.ArchivedAt = new Date();
    await seller.save({ session });
    await audit.log('ARCHIVE_SELLER', 'Seller', sellerId, { Name: seller.Name }, session);
    return seller.toObject();
  });
}

module.exports = { listSellers, createSeller, updateSeller, archiveSeller };
