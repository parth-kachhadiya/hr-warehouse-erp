const { Router } = require('express');
const c = require('../controllers/system.controller');
const { requireFields } = require('../middleware/validate');

const r = Router();
r.get('/categories', c.listCategories);
r.post('/categories', requireFields('Name'), c.addCategory);
r.post('/categories/:id/remove', c.removeCategory);
r.get('/custom-fields', c.listCustomFields);
r.post('/custom-fields', requireFields('FieldName'), c.addCustomField);
r.post('/custom-fields/:id/remove', c.removeCustomField);
r.get('/settings', c.getSettings);
r.put('/settings', c.updateSettings);
r.get('/health', c.health);
module.exports = r;
