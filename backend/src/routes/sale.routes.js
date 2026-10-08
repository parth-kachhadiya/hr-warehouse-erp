const { Router } = require('express');
const c = require('../controllers/sale.controller');

const r = Router();
r.get('/', c.list);
r.post('/preview', c.preview);
r.post('/', c.create);
r.post('/:id/deliver', c.deliver);
r.post('/:id/void', c.void);
module.exports = r;
