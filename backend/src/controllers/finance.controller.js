const finance = require('../services/finance.service');
const { getDeadStock } = require('../services/deadStock.service');
const { send } = require('./respond');

module.exports = {
  summary: async (req, res) => send(res, await finance.getFinanceSummary()),
  deadStock: async (req, res) => send(res, await getDeadStock()),
};
