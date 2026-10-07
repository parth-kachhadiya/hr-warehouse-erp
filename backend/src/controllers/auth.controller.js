const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { cookieOptions, COOKIE_NAME } = require('../middleware/auth.middleware');
const { send } = require('./respond');

async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) throw new AppError(400, 'Enter username and password');
  const userOk = String(username) === env.ADMIN_USERNAME;
  const passOk = await bcrypt.compare(String(password), env.ADMIN_PASSWORD_HASH);
  if (!userOk || !passOk) throw new AppError(401, 'Wrong username or password');
  const token = jwt.sign({ sub: 'admin', username: env.ADMIN_USERNAME }, env.JWT_SECRET, { expiresIn: '12h' });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  send(res, { username: env.ADMIN_USERNAME });
}

function logout(req, res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
  send(res, { loggedOut: true });
}

function me(req, res) {
  send(res, { username: req.user.username });
}

module.exports = { login, logout, me };
