const service = require('../services/sale.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.listSales({ status: req.query.status })),
  preview: async (req, res) => send(res, await service.previewSale(req.body)),
  create: async (req, res) => send(res, await service.createSale(req.body), 201),
  pay: async (req, res) => send(res, await service.recordPayment(req.params.id, req.body), 201),
  deliver: async (req, res) => send(res, await service.markOrderDelivered(req.params.id, req.body)),
  void: async (req, res) => send(res, await service.voidSale(req.params.id, req.body)),
};
