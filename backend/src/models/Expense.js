const { Schema, model } = require('mongoose');

const expenseSchema = new Schema(
  {
    ExpenseID: { type: String, required: true, unique: true },
    Date: { type: Date, default: Date.now },
    Category: { type: String, default: 'Other' },
    Amount: { type: Number, default: 0 },
    Notes: { type: String, default: '' },
    MaintenanceID: { type: String, default: '' }, // set when the expense was made by a Maintenance entry
    Status: { type: String, default: 'Active' }, // Active / Void
    VoidDate: { type: Date, default: null },
    VoidReason: { type: String, default: '' },
  },
  { versionKey: false }
);

module.exports = model('Expense', expenseSchema);
