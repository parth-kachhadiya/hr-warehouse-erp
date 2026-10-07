// Seller settlements: paying sellers what they are owed.
const { Seller, Settlement } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { toNumber, round2 } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');

const text = (v) => String(v ?? '').trim();

async function listSettlements() {
  return Settlement.find().sort({ SettlementID: -1 }).lean();
}

// paySeller
async function paySeller(input) {
  const amount = round2(toNumber(input.Amount, NaN));
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, 'Amount must be more than 0');
  return withTransaction(async (session) => {
    const seller = await Seller.findOne({ SellerID: text(input.SellerID) }).session(session);
    if (!seller) throw new AppError(404, 'Seller not found');
    if (amount > round2(seller.TotalPayable)) throw new AppError(400, `Amount is more than the payable balance (₹${round2(seller.TotalPayable)})`);

    seller.TotalPayable = round2(seller.TotalPayable - amount);
    seller.TotalSettled = round2(seller.TotalSettled + amount);
    await seller.save({ session });

    const SettlementID = await nextId('STL', session);
    const settlement = await new Settlement({
      SettlementID,
      Date: new Date(),
      SellerID: seller.SellerID,
      SellerName: seller.Name,
      Amount: amount,
      Mode: text(input.Mode) || 'Bank Transfer',
      Notes: text(input.Notes),
      Status: 'Active',
    }).save({ session });

    await audit.log('PAY_SELLER', 'Settlement', SettlementID, { SellerID: seller.SellerID, Amount: amount }, session);
    return { settlement: settlement.toObject(), seller: seller.toObject() };
  });
}

module.exports = { listSettlements, paySeller };
