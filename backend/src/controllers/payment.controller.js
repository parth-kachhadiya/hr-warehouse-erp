const service = require('../services/payment.service');
const sales = require('../services/sale.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.listPayments()),
  receivables: async (req, res) => send(res, await service.listReceivables()),
  create: async (req, res) => send(res, await sales.recordPayment(req.body.SaleID, req.body), 201),
};
