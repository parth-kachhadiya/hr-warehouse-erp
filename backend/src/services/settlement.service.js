// Seller settlements (same rules as paySeller / getSettlements in the old script).
const { Seller, Settlement } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { num, text } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');

async function listSettlements() {
  return Settlement.find().sort({ SettlementID: 1 }).lean();
}

async function paySeller(p = {}) {
  return withTransaction(async (session) => {
    const seller = await Seller.findOne({ SellerID: p.sellerID }).session(session);
    if (!seller) throw new AppError(404, 'Seller not found.');
    const payable = Number(seller.TotalPayable) || 0;
    const amount = num(p.amount, 'Settlement amount', { positive: true });
    if (amount > payable) throw new AppError(400, `Amount exceeds payable balance ${payable}.`);
    seller.TotalPayable = payable - amount;
    seller.TotalSettled = (Number(seller.TotalSettled) || 0) + amount;
    await seller.save({ session });
    await new Settlement({
      SettlementID: await nextId('STL', session),
      Date: new Date(),
      SellerID: p.sellerID,
      SellerName: seller.Name,
      Amount: amount,
      Mode: text(p.mode) || 'Bank Transfer',
      Notes: text(p.notes),
      Status: 'Active',
    }).save({ session });
    await audit.log('SELLER_SETTLEMENT', 'Seller', p.sellerID, { amount }, session);
    return true;
  });
}

module.exports = { listSettlements, paySeller };
