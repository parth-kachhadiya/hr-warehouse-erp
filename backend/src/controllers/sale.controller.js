const service = require('../services/sale.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.getSales()),
  preview: async (req, res) => send(res, await service.previewBilling(req.body.assetID, req.body.quantity, req.body.unitSalePrice)),
  create: async (req, res) => send(res, await service.createSale(req.body), 201),
  deliver: async (req, res) => send(res, await service.markOrderDelivered(req.params.id, req.body.quantity)),
  void: async (req, res) => send(res, await service.voidSale(req.params.id, req.body.reason)),
};
