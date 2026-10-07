// Money paid out to sellers.
const { Schema, model } = require('mongoose');

const settlementSchema = new Schema(
  {
    SettlementID: { type: String, required: true, unique: true },
    Date: { type: Date, default: Date.now },
    SellerID: { type: String, required: true, index: true },
    SellerName: { type: String, default: '' },
    Amount: { type: Number, default: 0 },
    Mode: { type: String, default: 'Bank Transfer' },
    Notes: { type: String, default: '' },
    Status: { type: String, default: 'Active' },
    ReversalOf: { type: String, default: '' },
  },
  { versionKey: false }
);

module.exports = model('Settlement', settlementSchema);
