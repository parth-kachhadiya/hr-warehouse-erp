const { Router } = require('express');
const c = require('../controllers/seller.controller');
const { requireFields } = require('../middleware/validate');

const r = Router();
r.get('/', c.list);
r.post('/', requireFields('Name'), c.create);
r.put('/:id', c.update);
r.post('/:id/archive', c.archive);
module.exports = r;
