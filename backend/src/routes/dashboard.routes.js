const { Router } = require('express');
const c = require('../controllers/dashboard.controller');

const r = Router();
r.get('/', c.get);
module.exports = r;
