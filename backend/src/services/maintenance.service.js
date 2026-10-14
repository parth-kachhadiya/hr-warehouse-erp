// Maintenance (repairs). A repair cost is spread over the product's available units and
// added to their selling price (Asset.RepairCostPerUnit). The buyer pays it at billing and
// HR gets it back; the seller's share and the commission ignore it. Each entry also writes
// a matching Expense (category "Maintenance") so Finance shows the money spent.
const { Asset, Expense, Maintenance, Sale } = require('../models');
const { nextIds } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { num, round2, text } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');
const { addReversal } = require('./sale.service');

const REPAIRABLE_STATUSES = ['In Stock', 'Listed', 'Damaged'];

async function getMaintenance() {
  return Maintenance.find({ Status: { $ne: 'Void' } }).sort({ Date: -1, MaintenanceID: -1 }).lean();
}

async function addMaintenance(m) {
  if (!m) throw new AppError(400, 'Maintenance data missing.');
  const description = text(m.description);
  if (!description) throw new AppError(400, 'Describe the repair.');
  const totalCost = round2(num(m.cost, 'Repair cost', { positive: true }));
  const date = m.date ? new Date(m.date) : new Date();
  if (Number.isNaN(date.getTime())) throw new AppError(400, 'Repair date is not valid.');

  const asset = await Asset.findOne({ AssetID: text(m.assetID) }).lean();
  if (!asset) throw new AppError(404, 'Asset not found.');
  if (!REPAIRABLE_STATUSES.includes(asset.Status)) {
    throw new AppError(400, `Only In Stock, Listed or Damaged products can get maintenance. Current status: ${asset.Status}.`);
  }
  const units = Math.floor(Number(asset.QuantityAvailable) || 0);
  if (units < 1) throw new AppError(400, 'This product has no available units to add a repair cost to.');
  const costPerUnit = round2(totalCost / units);

  const [maintenanceID, expenseID, auditID] = await nextIds('MNT', 'EXP', 'AUD');
  return withTransaction(async (session) => {
    // Conditional, so a sale that takes the last units at the same moment can't be missed.
    const updated = await Asset.updateOne(
      { AssetID: asset.AssetID, Status: { $in: REPAIRABLE_STATUSES }, QuantityAvailable: units },
      { $inc: { RepairCostPerUnit: costPerUnit } },
      { session }
    );
    if (!updated.matchedCount) throw new AppError(409, 'This product changed a moment ago. Please try again.');

    await new Maintenance({
      MaintenanceID: maintenanceID, Date: date, AssetID: asset.AssetID, ItemName: asset.ItemName,
      SellerID: asset.SellerID || '', Description: description, TotalCost: totalCost, Units: units,
      CostPerUnit: costPerUnit, ExpenseID: expenseID, Status: 'Active',
    }).save({ session });
    await new Expense({
      ExpenseID: expenseID, Date: date, Category: 'Maintenance', Amount: totalCost,
      Notes: `${maintenanceID} · ${asset.AssetID} ${asset.ItemName}: ${description}`,
      MaintenanceID: maintenanceID, Status: 'Active',
    }).save({ session });
    await audit.log('MAINTENANCE_ADD', 'Asset', asset.AssetID, {
      maintenanceID, totalCost, units, costPerUnit, description,
    }, session, auditID);
    return { maintenanceID, costPerUnit, units };
  });
}

// Undo a repair entry. Only allowed while no sale has been made on the product since,
// because a sale already charged the buyer for it.
async function voidMaintenance(id, reasonInput) {
  const reason = text(reasonInput) || 'Voided from ERP UI';
  return withTransaction(async (session) => {
    const entry = await Maintenance.findOne({ MaintenanceID: id }).session(session);
    if (!entry) throw new AppError(404, 'Maintenance entry not found.');
    if (entry.Status === 'Void') throw new AppError(400, 'Maintenance entry already voided.');
    const soldSince = await Sale.exists({
      AssetID: entry.AssetID, TransactionStatus: { $ne: 'Void' }, Date: { $gte: entry._id.getTimestamp() },
    }).session(session);
    if (soldSince) throw new AppError(400, 'This product was sold after the repair, so the repair cost was already charged. It cannot be voided.');

    const asset = await Asset.findOne({ AssetID: entry.AssetID }).session(session);
    if (asset) {
      asset.RepairCostPerUnit = Math.max(0, round2((Number(asset.RepairCostPerUnit) || 0) - entry.CostPerUnit));
      await asset.save({ session });
    }
    Object.assign(entry, { Status: 'Void', VoidDate: new Date(), VoidReason: reason });
    await entry.save({ session });
    if (entry.ExpenseID) {
      await Expense.updateOne(
        { ExpenseID: entry.ExpenseID, Status: { $ne: 'Void' } },
        { $set: { Status: 'Void', VoidDate: new Date(), VoidReason: `Maintenance ${id} voided` } },
        { session }
      );
      await addReversal('Expense', entry.ExpenseID, entry.TotalCost, `Maintenance ${id} voided`, {}, session);
    }
    await audit.log('MAINTENANCE_VOID', 'Asset', entry.AssetID, { maintenanceID: id, reason }, session);
    return true;
  });
}

module.exports = { getMaintenance, addMaintenance, voidMaintenance };
