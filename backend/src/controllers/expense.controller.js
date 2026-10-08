const service = require('../services/expense.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.getExpenses()),
  create: async (req, res) => send(res, await service.addExpense(req.body), 201),
  remove: async (req, res) => send(res, await service.deleteExpense(req.params.id)),
};
