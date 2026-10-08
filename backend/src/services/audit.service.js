// Writes one row to the AuditLog. The Actor is always "Admin" (single login).
const { AuditLog } = require('../models');
const { nextId } = require('../utils/idGenerator');

async function log(action, entityType, entityId, details = {}, session) {
  const AuditID = await nextId('AUD', session);
  await new AuditLog({
    AuditID,
    Timestamp: new Date(),
    Actor: 'Admin',
    Action: action,
    EntityType: entityType || '',
    EntityID: entityId || '',
    Details: details || {},
  }).save({ session });
}

// Same as getAuditLog(limit): newest first, default 100, at most 500.
async function getAuditLog(limit) {
  const n = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return AuditLog.find().sort({ Timestamp: -1, AuditID: -1 }).limit(n).lean();
}

module.exports = { log, getAuditLog };
