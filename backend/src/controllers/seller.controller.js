const service = require('../services/seller.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.listSellers({ includeArchived: req.query.includeArchived === 'true' })),
  create: async (req, res) => send(res, await service.createSeller(req.body), 201),
  update: async (req, res) => send(res, await service.updateSeller(req.params.id, req.body)),
  archive: async (req, res) => send(res, await service.archiveSeller(req.params.id)),
};
