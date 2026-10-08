const { Router } = require('express');
const c = require('../controllers/settlement.controller');

const r = Router();
r.get('/', c.list);
r.post('/', c.create);
module.exports = r;
