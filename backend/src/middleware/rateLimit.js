// Only 5 failed login attempts per 15 minutes from the same address.
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many failed login attempts. Try again in 15 minutes.' },
});

module.exports = { loginLimiter };
