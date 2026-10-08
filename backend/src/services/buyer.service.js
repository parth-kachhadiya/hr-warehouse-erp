// Buyers (same rules as getBuyers / addBuyer / updateBuyer / deleteBuyer in the old script).
const { Buyer, Sale } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { text } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');

async function listBuyers() {
  return Buyer.find({ Active: true }).sort({ BuyerID: 1 }).lean();
}

async function createBuyer(input = {}) {
  return withTransaction(async (session) => {
    if (!text(input.name)) throw new AppError(400, 'Buyer name required.');
    const BuyerID = await nextId('BUY', session);
    await new Buyer({
      BuyerID,
      Name: text(input.name),
      Phone: text(input.phone),
      Email: text(input.email),
      Address: text(input.address),
      GSTIN: text(input.gstin),
      JoinDate: new Date(),
      TotalPurchased: 0,
      Active: true,
    }).save({ session });
    await audit.log('BUYER_ADD', 'Buyer', BuyerID, { name: text(input.name) }, session);
    return BuyerID;
  });
}

async function updateBuyer(buyerId, input = {}) {
  return withTransaction(async (session) => {
    const buyer = await Buyer.findOne({ BuyerID: buyerId }).session(session);
    if (!buyer) throw new AppError(404, 'Buyer not found.');
    Object.assign(buyer, {
      Name: text(input.name),
      Phone: text(input.phone),
      Email: text(input.email),
      Address: text(input.address),
      GSTIN: text(input.gstin),
    });
    await buyer.save({ session });
    await audit.log('BUYER_UPDATE', 'Buyer', buyerId, {}, session);
    return true;
  });
}

async function deleteBuyer(buyerId) {
  return withTransaction(async (session) => {
    const buyer = await Buyer.findOne({ BuyerID: buyerId }).session(session);
    if (!buyer) throw new AppError(404, 'Buyer not found.');
    if (await Sale.exists({ BuyerID: buyerId }).session(session)) {
      throw new AppError(400, 'Buyer has sale history and cannot be deleted. Archive instead.');
    }
    buyer.Active = false;
    buyer.ArchivedAt = new Date();
    await buyer.save({ session });
    await audit.log('BUYER_ARCHIVE', 'Buyer', buyerId, {}, session);
    return true;
  });
}

module.exports = { listBuyers, createBuyer, updateBuyer, deleteBuyer };
