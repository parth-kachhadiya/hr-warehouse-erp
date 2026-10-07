const { Router } = require('express');
const c = require('../controllers/settlement.controller');
const { requireFields } = require('../middleware/validate');

const r = Router();
r.get('/', c.list);
r.post('/', requireFields('SellerID', 'Amount'), c.create);
module.exports = r;
