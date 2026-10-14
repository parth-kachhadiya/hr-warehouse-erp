// A question from a buyer or seller (what they want to buy or sell). Only a record:
// it never creates a sale, a product, or a new buyer/seller.
const { Schema, model } = require('mongoose');

const inquirySchema = new Schema(
  {
    InquiryID: { type: String, required: true, unique: true },
    Type: { type: String, enum: ['Buyer', 'Seller'], required: true, index: true },
    Date: { type: Date, default: Date.now },
    PersonID: { type: String, default: '', index: true }, // BuyerID / SellerID when the person already exists
    Name: { type: String, required: true, trim: true },
    Area: { type: String, default: '' },
    Category: { type: String, default: '' },
    Mobile: { type: String, default: '' }, // optional
    Status: { type: String, default: 'Active' }, // Active / Void
    VoidDate: { type: Date, default: null },
  },
  { versionKey: false }
);

module.exports = model('Inquiry', inquirySchema);
