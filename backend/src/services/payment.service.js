// Payments tab: history of buyer payments and the list of sales with money still due.
const { Payment, Sale } = require('../models');
const { round2 } = require('../utils/number');

async function listPayments() {
  return Payment.find().sort({ PaymentID: -1 }).lean();
}

async function listReceivables() {
  const sales = await Sale.find({ TransactionStatus: 'Active', PaymentStatus: { $in: ['Unpaid', 'Partial'] } }).sort({ SaleID: 1 }).lean();
  return sales.map((s) => ({ ...s, Balance: round2(s.SalePrice - s.ReceivedAmount) }));
}

module.exports = { listPayments, listReceivables };
