const { Router } = require('express');
const c = require('../controllers/maintenance.controller');

const r = Router();
r.get('/', c.list);
r.post('/', c.create);
r.post('/:id/void', c.remove);
module.exports = r;
