const service = require('../services/asset.service');
const media = require('../services/media.service');
const inventory = require('../services/inventory.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.getAssets()),
  utilization: async (req, res) => send(res, await inventory.getWarehouseUtilization()),
  ledger: async (req, res) => send(res, await inventory.getInventoryLedger(req.query.assetID)),
  create: async (req, res) => send(res, await service.addAsset(req.body), 201),
  update: async (req, res) => send(res, await service.updateAsset(req.params.id, req.body)),
  adjust: async (req, res) => send(res, await service.adjustAssetQuantity(req.params.id, req.body.newTotalQty, req.body.reason)),
  status: async (req, res) => send(res, await service.setAssetStatus(req.params.id, req.body.status)),
  remove: async (req, res) => send(res, await service.deleteAsset(req.params.id)),
  media: async (req, res) => send(res, await media.uploadAssetMedia(req.params.id, req.file)),
};
