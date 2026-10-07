// Mounts every route. Everything below requireAuth needs a valid login,
// so a new route added later is protected automatically.
const { Router } = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const auth = require('./auth.routes');

const router = Router();

// Public
router.get('/ping', (req, res) => res.json({ success: true, data: 'ok' })); // for the host's health check
router.use('/auth', auth.publicRoutes);

// Private
router.use('/auth', auth.privateRoutes);
router.use(requireAuth);
router.use('/sellers', require('./seller.routes'));
router.use('/buyers', require('./buyer.routes'));
router.use('/assets', require('./asset.routes'));
router.use('/sales', require('./sale.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/settlements', require('./settlement.routes'));
router.use('/storage', require('./storage.routes'));
router.use('/expenses', require('./expense.routes'));
router.use('/finance', require('./finance.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/system', require('./system.routes'));
router.use('/audit', require('./audit.routes'));

module.exports = router;
