const service = require('../services/buyer.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.listBuyers({ includeArchived: req.query.includeArchived === 'true' })),
  create: async (req, res) => send(res, await service.createBuyer(req.body), 201),
  update: async (req, res) => send(res, await service.updateBuyer(req.params.id, req.body)),
  archive: async (req, res) => send(res, await service.archiveBuyer(req.params.id)),
};
