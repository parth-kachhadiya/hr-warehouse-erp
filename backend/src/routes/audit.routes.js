const { Router } = require('express');
const c = require('../controllers/audit.controller');

const r = Router();
r.get('/', c.list);
module.exports = r;
