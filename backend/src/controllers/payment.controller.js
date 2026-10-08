const service = require('../services/payment.service');
const sales = require('../services/sale.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.listPayments()),
  create: async (req, res) => send(res, await sales.recordPayment(req.body), 201),
};
