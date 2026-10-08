const { Router } = require('express');
const c = require('../controllers/seller.controller');

const r = Router();
r.get('/', c.list);
r.post('/', c.create);
r.put('/:id', c.update);
r.delete('/:id', c.remove);
module.exports = r;
