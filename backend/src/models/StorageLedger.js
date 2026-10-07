// Monthly storage rent charges, one row per product per billing run.
const { Schema, model } = require('mongoose');

const storageLedgerSchema = new Schema(
  {
    EntryID: { type: String, required: true, unique: true },
    Month: { type: String, required: true, index: true }, // yyyy-MM
    SellerID: { type: String, default: '' },
    SellerName: { type: String, default: '' },
    SpaceOccupiedSqFt: { type: Number, default: 0 },
    RatePerSqFt: { type: Number, default: 0 },
    Charge: { type: Number, default: 0 },
    DateRun: { type: Date, default: Date.now },
    AssetID: { type: String, default: '', index: true },
    DaysCharged: { type: Number, default: 0 },
    Quantity: { type: Number, default: 0 },
    UnitSpaceSqFt: { type: Number, default: 0 },
    SpaceDaysCharged: { type: Number, default: 0 },
    Status: { type: String, default: 'Active' },
  },
  { versionKey: false }
);

module.exports = model('StorageLedger', storageLedgerSchema);
