// Quick check that required fields are present in the request body.
// Detailed business rules are checked in the services.
const AppError = require('../utils/AppError');

const requireFields = (...fields) => (req, res, next) => {
  const body = req.body || {};
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === '');
  if (missing.length) return next(new AppError(400, `Missing: ${missing.join(', ')}`));
  return next();
};

module.exports = { requireFields };
