// Every stock movement. Deltas show how each quantity bucket changed.
const { Schema, model } = require('mongoose');

const inventoryLedgerSchema = new Schema(
  {
    MovementID: { type: String, required: true, unique: true },
    Timestamp: { type: Date, default: Date.now },
    AssetID: { type: String, required: true, index: true },
    SellerID: { type: String, default: '' },
    Type: { type: String, enum: ['RECEIPT', 'RESERVE', 'RELEASE', 'DELIVER', 'REMOVE', 'ADJUST'], required: true },
    PhysicalQtyDelta: { type: Number, default: 0 },
    AvailableQtyDelta: { type: Number, default: 0 },
    ReservedQtyDelta: { type: Number, default: 0 },
    DeliveredQtyDelta: { type: Number, default: 0 },
    RemovedQtyDelta: { type: Number, default: 0 },
    SaleID: { type: String, default: '' },
    Notes: { type: String, default: '' },
    Status: { type: String, default: 'Active' },
  },
  { versionKey: false }
);

module.exports = model('InventoryLedger', inventoryLedgerSchema);
