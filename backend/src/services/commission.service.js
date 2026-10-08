// Commission (same as calcCommission_): rate picked from the three tiers in Settings, amount rounded.
const { num } = require('../utils/number');

function calcCommission(amountInput, settings) {
  const amount = num(amountInput, 'Sale price', { positive: true });
  const tier1 = settings.CommissionTier1Max ?? 100000;
  const tier2 = settings.CommissionTier2Max ?? 500000;
  const rate = amount <= tier1 ? settings.CommissionTier1Rate ?? 0.1
    : amount <= tier2 ? settings.CommissionTier2Rate ?? 0.1
      : settings.CommissionTier3Rate ?? 0.1;
  return { rate, amount: Math.round(amount * rate) };
}

module.exports = { calcCommission };
