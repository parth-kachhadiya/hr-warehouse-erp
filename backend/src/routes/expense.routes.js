const { Router } = require('express');
const c = require('../controllers/expense.controller');

const r = Router();
r.get('/', c.list);
r.post('/', c.create);
r.delete('/:id', c.remove);
module.exports = r;
