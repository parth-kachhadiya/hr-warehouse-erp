// A repair done on a product. The cost is spread over the units still available and
// added to their selling price; the buyer pays it, the seller's share is not reduced.
const { Schema, model } = require('mongoose');

const maintenanceSchema = new Schema(
  {
    MaintenanceID: { type: String, required: true, unique: true },
    Date: { type: Date, default: Date.now },
    AssetID: { type: String, required: true, index: true },
    ItemName: { type: String, default: '' },
    SellerID: { type: String, default: '' },
    Description: { type: String, default: '' },
    TotalCost: { type: Number, default: 0 },
    Units: { type: Number, default: 1 }, // available units the cost was spread over
    CostPerUnit: { type: Number, default: 0 },
    ExpenseID: { type: String, default: '' }, // the matching Expense row (category Maintenance)
    Status: { type: String, default: 'Active' }, // Active / Void
    VoidDate: { type: Date, default: null },
    VoidReason: { type: String, default: '' },
  },
  { versionKey: false }
);

module.exports = model('Maintenance', maintenanceSchema);
