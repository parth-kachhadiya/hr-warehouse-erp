const system = require('../services/system.service');
const settings = require('../services/settings.service');
const { send } = require('./respond');

module.exports = {
  listCategories: async (req, res) => send(res, await system.listCategories()),
  addCategory: async (req, res) => send(res, await system.addCategory(req.body), 201),
  deleteCategory: async (req, res) => send(res, await system.deleteCategory(req.params.id)),

  listCustomFields: async (req, res) => send(res, await system.listCustomFields(req.query.module)),
  addCustomField: async (req, res) => send(res, await system.addCustomField(req.body), 201),
  deleteCustomField: async (req, res) => send(res, await system.deleteCustomField(req.params.id)),

  getSettings: async (req, res) => send(res, await settings.getSettings()),
  updateSettings: async (req, res) => send(res, await settings.updateSettings(req.body)),

  health: async (req, res) => send(res, await system.getSystemHealth()),
  sync: async (req, res) => send(res, await system.syncSystem()),
};
