const { Router } = require('express');
const c = require('../controllers/expense.controller');
const { requireFields } = require('../middleware/validate');

const r = Router();
r.get('/', c.list);
r.post('/', requireFields('Amount'), c.create);
r.post('/:id/void', requireFields('reason'), c.void);
module.exports = r;
