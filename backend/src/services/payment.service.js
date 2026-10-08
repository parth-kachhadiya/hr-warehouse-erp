// getPayments: every buyer payment row.
const { Payment } = require('../models');

async function listPayments() {
  return Payment.find().sort({ PaymentID: 1 }).lean();
}

module.exports = { listPayments };
