const { getDashboard } = require('../services/dashboard.service');
const { send } = require('./respond');

module.exports = {
  get: async (req, res) => send(res, await getDashboard()),
};
