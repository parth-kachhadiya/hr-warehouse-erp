const { Router } = require('express');
const c = require('../controllers/system.controller');

const r = Router();
r.get('/categories', c.listCategories);
r.post('/categories', c.addCategory);
r.delete('/categories/:id', c.deleteCategory);
r.get('/custom-fields', c.listCustomFields);
r.post('/custom-fields', c.addCustomField);
r.delete('/custom-fields/:id', c.deleteCustomField);
r.get('/settings', c.getSettings);
r.put('/settings', c.updateSettings);
r.get('/health', c.health);
r.post('/sync', c.sync);
module.exports = r;
