const { Router } = require('express');
const c = require('../controllers/finance.controller');

const r = Router();
r.get('/summary', c.summary);
r.get('/dead-stock', c.deadStock);
module.exports = r;
