const service = require('../services/maintenance.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.getMaintenance()),
  create: async (req, res) => send(res, await service.addMaintenance(req.body), 201),
  remove: async (req, res) => send(res, await service.voidMaintenance(req.params.id, req.body && req.body.reason)),
};
