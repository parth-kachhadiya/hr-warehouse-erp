const { Schema, model } = require('mongoose');

const sellerSchema = new Schema(
  {
    SellerID: { type: String, required: true, unique: true },
    Name: { type: String, required: true, trim: true },
    Phone: { type: String, default: '' },
    Email: { type: String, default: '' },
    Address: { type: String, default: '' },
    GSTIN: { type: String, default: '' },
    KYCStatus: { type: String, default: 'Pending' },
    JoinDate: { type: Date, default: Date.now },
    TotalPayable: { type: Number, default: 0 },
    TotalSettled: { type: Number, default: 0 },
    Active: { type: Boolean, default: true },
    ArchivedAt: { type: Date, default: null },
    MediaFolderId: { type: String, default: '' },
  },
  { versionKey: false }
);

module.exports = model('Seller', sellerSchema);
