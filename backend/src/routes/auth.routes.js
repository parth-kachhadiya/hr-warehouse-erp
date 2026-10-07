const { Router } = require('express');
const c = require('../controllers/auth.controller');
const { loginLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth.middleware');

// Public: login and logout. Private: "who am I" check used by the React app.
const publicRoutes = Router();
publicRoutes.post('/login', loginLimiter, c.login);
publicRoutes.post('/logout', c.logout);

const privateRoutes = Router();
privateRoutes.get('/me', requireAuth, c.me);

module.exports = { publicRoutes, privateRoutes };
