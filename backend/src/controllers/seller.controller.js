const service = require('../services/seller.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.listSellers()),
  create: async (req, res) => send(res, await service.createSeller(req.body), 201),
  update: async (req, res) => send(res, await service.updateSeller(req.params.id, req.body)),
  remove: async (req, res) => send(res, await service.deleteSeller(req.params.id)),
};
