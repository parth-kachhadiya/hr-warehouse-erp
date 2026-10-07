const { Router } = require('express');
const c = require('../controllers/storage.controller');

const r = Router();
r.post('/run', c.run);
r.get('/ledger', c.ledger);
r.get('/seller-space', c.sellerSpace);
module.exports = r;
