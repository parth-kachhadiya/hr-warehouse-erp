const { Schema, model } = require('mongoose');

const auditLogSchema = new Schema(
  {
    AuditID: { type: String, required: true, unique: true },
    Timestamp: { type: Date, default: Date.now, index: true },
    Actor: { type: String, default: 'Admin' },
    Action: { type: String, required: true },
    EntityType: { type: String, default: '' },
    EntityID: { type: String, default: '' },
    Details: { type: Schema.Types.Mixed, default: {} },
  },
  { versionKey: false, minimize: false }
);

module.exports = model('AuditLog', auditLogSchema);
