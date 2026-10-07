const { Schema, model } = require('mongoose');

const saleSchema = new Schema(
  {
    SaleID: { type: String, required: true, unique: true },
    Date: { type: Date, default: Date.now },
    AssetID: { type: String, required: true, index: true },
    ItemName: { type: String, default: '' },
    Quantity: { type: Number, required: true },
    DeliveredQty: { type: Number, default: 0 },
    UnitSalePrice: { type: Number, default: 0 },
    BuyerID: { type: String, default: '', index: true },
    BuyerName: { type: String, default: '' },
    SalePrice: { type: Number, default: 0 }, // total
    CommissionRate: { type: Number, default: 0 },
    CommissionAmount: { type: Number, default: 0 },
    StorageCharge: { type: Number, default: 0 }, // always 0, kept for parity
    MarketingCharge: { type: Number, default: 0 },
    RepairCharge: { type: Number, default: 0 },
    LogisticsCharge: { type: Number, default: 0 },
    HRGrossRevenue: { type: Number, default: 0 },
    SellerPayable: { type: Number, default: 0 },
    ReceivedAmount: { type: Number, default: 0 },
    PaymentStatus: { type: String, default: 'Unpaid' }, // Unpaid / Partial / Paid / Void
    OrderStatus: { type: String, default: 'Reserved' }, // Reserved / Ready for Pickup / Partially Delivered / Delivered / Cancelled
    DeliveredAt: { type: Date, default: null },
    CancelledAt: { type: Date, default: null },
    Notes: { type: String, default: '' },
    TransactionStatus: { type: String, default: 'Active' }, // Active / Void
    VoidDate: { type: Date, default: null },
    VoidReason: { type: String, default: '' },
  },
  { versionKey: false }
);

module.exports = model('Sale', saleSchema);
