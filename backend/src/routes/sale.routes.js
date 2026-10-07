const { Router } = require('express');
const c = require('../controllers/sale.controller');
const { requireFields } = require('../middleware/validate');

const r = Router();
r.get('/', c.list);
r.post('/preview', requireFields('AssetID', 'Quantity', 'UnitSalePrice'), c.preview);
r.post('/', requireFields('AssetID', 'Quantity', 'UnitSalePrice'), c.create);
r.post('/:id/payments', requireFields('Amount'), c.pay);
r.post('/:id/deliver', c.deliver);
r.post('/:id/void', requireFields('reason'), c.void);
module.exports = r;
