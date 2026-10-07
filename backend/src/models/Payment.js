// Money received from buyers.
const { Schema, model } = require('mongoose');

const paymentSchema = new Schema(
  {
    PaymentID: { type: String, required: true, unique: true },
    Date: { type: Date, default: Date.now },
    SaleID: { type: String, default: '', index: true },
    BuyerID: { type: String, default: '' },
    BuyerName: { type: String, default: '' },
    Amount: { type: Number, default: 0 },
    Mode: { type: String, default: 'Cash' },
    Notes: { type: String, default: '' },
    Status: { type: String, default: 'Active' }, // Active / Void
    ReversalOf: { type: String, default: '' },
  },
  { versionKey: false }
);

module.exports = model('Payment', paymentSchema);
