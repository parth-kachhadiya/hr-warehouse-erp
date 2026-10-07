const audit = require('../services/audit.service');
const { send } = require('./respond');

module.exports = {
  list: async (req, res) => send(res, await audit.listRecent(150)),
};
