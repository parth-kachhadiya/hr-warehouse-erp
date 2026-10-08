const service = require('../services/storageBilling.service');
const { send } = require('./respond');

module.exports = {
  run: async (req, res) => send(res, await service.runMonthlyStorageBilling()),
  ledger: async (req, res) => send(res, await service.getStorageLedger()),
  sellerSpace: async (req, res) => send(res, await service.getSellerSpaceSummary()),
};
