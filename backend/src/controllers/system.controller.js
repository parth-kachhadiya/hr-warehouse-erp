const system = require('../services/system.service');
const settings = require('../services/settings.service');
const audit = require('../services/audit.service');
const { withTransaction } = require('../utils/transaction');
const { send } = require('./respond');

module.exports = {
  listCategories: async (req, res) => send(res, await system.listCategories({ includeInactive: req.query.includeInactive === 'true' })),
  addCategory: async (req, res) => send(res, await system.addCategory(req.body), 201),
  removeCategory: async (req, res) => send(res, await system.removeCategory(req.params.id)),

  listCustomFields: async (req, res) => send(res, await system.listCustomFields({ includeInactive: req.query.includeInactive === 'true' })),
  addCustomField: async (req, res) => send(res, await system.addCustomField(req.body), 201),
  removeCustomField: async (req, res) => send(res, await system.removeCustomField(req.params.id)),

  getSettings: async (req, res) => send(res, await settings.getSettings()),
  updateSettings: async (req, res) => {
    await withTransaction(async (session) => {
      const changed = await settings.updateSettings(req.body, session);
      await audit.log('UPDATE_SETTINGS', 'Settings', '', changed, session);
    });
    send(res, await settings.getSettings());
  },

  health: async (req, res) => send(res, await system.runHealthCheck()),
};
