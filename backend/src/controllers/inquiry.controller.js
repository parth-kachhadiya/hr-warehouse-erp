const service = require('../services/inquiry.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.getInquiries(req.query.type)),
  create: async (req, res) => send(res, await service.addInquiry(req.body), 201),
  remove: async (req, res) => send(res, await service.deleteInquiry(req.params.id)),
};
