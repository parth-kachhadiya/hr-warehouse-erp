const { Schema, model } = require('mongoose');

const reversalSchema = new Schema(
  {
    ReversalID: { type: String, required: true, unique: true },
    Timestamp: { type: Date, default: Date.now },
    EntityType: { type: String, default: '' },
    EntityID: { type: String, default: '' },
    Amount: { type: Number, default: 0 },
    Reason: { type: String, default: '' },
    Details: { type: Schema.Types.Mixed, default: {} },
  },
  { versionKey: false, minimize: false }
);

module.exports = model('Reversal', reversalSchema);
