const { Router } = require('express');
const c = require('../controllers/payment.controller');
const { requireFields } = require('../middleware/validate');

const r = Router();
r.get('/', c.list);
r.get('/receivables', c.receivables);
r.post('/', requireFields('SaleID', 'Amount'), c.create);
module.exports = r;
