// Commission and the money split for a sale.
const { round2 } = require('../utils/number');

// Picks the commission rate from the three tiers in Settings.
function getCommissionRate(total, settings) {
  if (total <= settings.CommissionTier1Max) return settings.CommissionTier1Rate;
  if (total <= settings.CommissionTier2Max) return settings.CommissionTier2Rate;
  return settings.CommissionTier3Rate;
}

// commission = round(total x rate)
// HRGrossRevenue = commission + marketing + repair + logistics
// SellerPayable = total - HRGrossRevenue
function calculateSaleSplit({ total, marketing = 0, repair = 0, logistics = 0 }, settings) {
  const CommissionRate = getCommissionRate(total, settings);
  const CommissionAmount = Math.round(total * CommissionRate);
  const HRGrossRevenue = round2(CommissionAmount + marketing + repair + logistics);
  const SellerPayable = round2(total - HRGrossRevenue);
  return { CommissionRate, CommissionAmount, HRGrossRevenue, SellerPayable };
}

module.exports = { getCommissionRate, calculateSaleSplit };
