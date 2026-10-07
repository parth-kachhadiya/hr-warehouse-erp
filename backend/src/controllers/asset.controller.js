const service = require('../services/asset.service');
const media = require('../services/media.service');
const { listMovements } = require('../services/inventory.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.listAssets({ status: req.query.status, search: req.query.search })),
  get: async (req, res) => send(res, await service.getAsset(req.params.id)),
  space: async (req, res) => send(res, await service.getWarehouseSpace()),
  create: async (req, res) => send(res, await service.addAsset(req.body), 201),
  update: async (req, res) => send(res, await service.updateAsset(req.params.id, req.body)),
  adjust: async (req, res) => send(res, await service.adjustQuantity(req.params.id, req.body)),
  archive: async (req, res) => send(res, await service.archiveAsset(req.params.id, req.body)),
  status: async (req, res) => send(res, await service.changeStatus(req.params.id, req.body)),
  movements: async (req, res) => send(res, await listMovements(req.params.id)),
  photos: async (req, res) => send(res, await media.uploadPhotos(req.params.id, req.files)),
  video: async (req, res) => send(res, await media.uploadVideo(req.params.id, req.file)),
};
