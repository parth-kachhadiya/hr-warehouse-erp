const service = require('../services/expense.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await service.listExpenses()),
  create: async (req, res) => send(res, await service.addExpense(req.body), 201),
  void: async (req, res) => send(res, await service.voidExpense(req.params.id, req.body)),
};
