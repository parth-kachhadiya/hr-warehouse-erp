// Buyers: customer records created by the operator. Soft delete only.
const { Buyer, Sale } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');

const text = (v) => String(v ?? '').trim();
const EDITABLE = ['Name', 'Phone', 'Email', 'Address', 'GSTIN'];

async function listBuyers({ includeArchived = false } = {}) {
  const filter = includeArchived ? {} : { Active: true };
  return Buyer.find(filter).sort({ BuyerID: 1 }).lean();
}

async function createBuyer(input) {
  const Name = text(input.Name);
  if (!Name) throw new AppError(400, 'Buyer name is required');
  return withTransaction(async (session) => {
    const BuyerID = await nextId('BUY', session);
    const buyer = await new Buyer({
      BuyerID,
      Name,
      Phone: text(input.Phone),
      Email: text(input.Email),
      Address: text(input.Address),
      GSTIN: text(input.GSTIN),
      JoinDate: new Date(),
    }).save({ session });
    await audit.log('CREATE_BUYER', 'Buyer', BuyerID, { Name }, session);
    return buyer.toObject();
  });
}

async function updateBuyer(buyerId, input) {
  return withTransaction(async (session) => {
    const buyer = await Buyer.findOne({ BuyerID: buyerId }).session(session);
    if (!buyer) throw new AppError(404, 'Buyer not found');
    const changes = {};
    EDITABLE.forEach((key) => {
      if (input[key] !== undefined) changes[key] = text(input[key]);
    });
    if ('Name' in changes && !changes.Name) throw new AppError(400, 'Buyer name is required');
    Object.assign(buyer, changes);
    await buyer.save({ session });
    if (changes.Name) await Sale.updateMany({ BuyerID: buyerId }, { $set: { BuyerName: changes.Name } }, { session });
    await audit.log('UPDATE_BUYER', 'Buyer', buyerId, changes, session);
    return buyer.toObject();
  });
}

async function archiveBuyer(buyerId) {
  return withTransaction(async (session) => {
    const buyer = await Buyer.findOne({ BuyerID: buyerId }).session(session);
    if (!buyer) throw new AppError(404, 'Buyer not found');
    if (!buyer.Active) throw new AppError(400, 'Buyer is already archived');
    const sales = await Sale.countDocuments({ BuyerID: buyerId }).session(session);
    if (sales > 0) throw new AppError(400, `Cannot archive: buyer has ${sales} sale(s).`);
    buyer.Active = false;
    buyer.ArchivedAt = new Date();
    await buyer.save({ session });
    await audit.log('ARCHIVE_BUYER', 'Buyer', buyerId, { Name: buyer.Name }, session);
    return buyer.toObject();
  });
}

module.exports = { listBuyers, createBuyer, updateBuyer, archiveBuyer };
