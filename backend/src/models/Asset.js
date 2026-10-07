// A product stored in the warehouse. Quantities are split into buckets:
// Received = Available + Reserved + Delivered + Removed (always).
const { Schema, model } = require('mongoose');

const assetSchema = new Schema(
  {
    AssetID: { type: String, required: true, unique: true },
    ItemName: { type: String, required: true, trim: true },
    Category: { type: String, default: '' },
    SellerID: { type: String, default: '', index: true },
    SellerName: { type: String, default: '' },
    DateReceived: { type: Date, default: Date.now },
    ConditionGrade: { type: String, enum: ['A', 'B', 'C', 'D', 'E'], default: 'C' },
    QuantityReceived: { type: Number, default: 0 },
    QuantityAvailable: { type: Number, default: 0 },
    QuantityReserved: { type: Number, default: 0 },
    QuantityDelivered: { type: Number, default: 0 },
    QuantityRemoved: { type: Number, default: 0 },
    SpaceSqFt: { type: Number, default: 0 }, // per unit
    ReservePrice: { type: Number, default: 0 }, // per unit
    ListedPrice: { type: Number, default: 0 }, // per unit
    Status: { type: String, default: 'In Stock' }, // In Stock / Listed / Damaged / Sold / Archived
    DateSold: { type: Date, default: null },
    Notes: { type: String, default: '' },
    PhotoLinks: { type: [String], default: [] },
    PhotoFileIds: { type: [String], default: [] },
    VideoLink: { type: String, default: '' },
    VideoFileId: { type: String, default: '' },
    CustomFieldsData: { type: Schema.Types.Mixed, default: {} },
    ArchivedAt: { type: Date, default: null },
  },
  { versionKey: false, minimize: false }
);

module.exports = model('Asset', assetSchema);
