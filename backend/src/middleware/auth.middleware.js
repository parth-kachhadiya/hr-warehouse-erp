// The "locked door": every /api route except login goes through this check.
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const COOKIE_NAME = 'hr_token';

function cookieOptions() {
  return {
    httpOnly: true, // JavaScript in the browser cannot read it
    secure: env.isProduction, // HTTPS only in production
    sameSite: env.isProduction ? 'none' : 'lax',
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
    path: '/',
  };
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return next(new AppError(401, 'Please log in'));
  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    return next();
  } catch {
    return next(new AppError(401, 'Your session has expired. Please log in again.'));
  }
}

module.exports = { requireAuth, cookieOptions, COOKIE_NAME };
