const { Schema, model } = require('mongoose');

const buyerSchema = new Schema(
  {
    BuyerID: { type: String, required: true, unique: true },
    Name: { type: String, required: true, trim: true },
    Phone: { type: String, default: '' },
    Email: { type: String, default: '' },
    Address: { type: String, default: '' },
    GSTIN: { type: String, default: '' },
    JoinDate: { type: Date, default: Date.now },
    TotalPurchased: { type: Number, default: 0 },
    Active: { type: Boolean, default: true },
    ArchivedAt: { type: Date, default: null },
  },
  { versionKey: false }
);

module.exports = model('Buyer', buyerSchema);
