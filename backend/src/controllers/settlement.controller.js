const service = require('../services/settlement.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.listSettlements()),
  create: async (req, res) => send(res, await service.paySeller(req.body), 201),
};
