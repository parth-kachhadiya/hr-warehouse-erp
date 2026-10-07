const { Router } = require('express');
const c = require('../controllers/asset.controller');
const { requireFields } = require('../middleware/validate');
const { photoUpload, videoUpload } = require('../middleware/upload.middleware');

const r = Router();
r.get('/', c.list);
r.get('/space', c.space);
r.post('/', requireFields('ItemName', 'QuantityReceived', 'SpaceSqFt'), c.create);
r.get('/:id', c.get);
r.put('/:id', c.update);
r.get('/:id/movements', c.movements);
r.post('/:id/adjust', requireFields('newQuantity', 'reason'), c.adjust);
r.post('/:id/archive', c.archive);
r.post('/:id/status', requireFields('Status'), c.status);
r.post('/:id/photos', photoUpload, c.photos);
r.post('/:id/video', videoUpload, c.video);
module.exports = r;
