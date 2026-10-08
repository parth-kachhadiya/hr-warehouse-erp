const { Router } = require('express');
const c = require('../controllers/asset.controller');
const { mediaUpload } = require('../middleware/upload.middleware');

const r = Router();
r.get('/', c.list);
r.get('/utilization', c.utilization);
r.get('/inventory-ledger', c.ledger);
r.post('/', c.create);
r.put('/:id', c.update);
r.post('/:id/adjust', c.adjust);
r.post('/:id/status', c.status);
r.delete('/:id', c.remove);
r.post('/:id/media', mediaUpload, c.media);
module.exports = r;
