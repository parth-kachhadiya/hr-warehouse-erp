// Dead stock: how long products have been sitting, and what to do about it.
const { Asset } = require('../models');
const { DAY_MS } = require('../utils/date');

function recommendation(days) {
  if (days < 30) return { Bucket: '0-29 days', Action: 'Monitor' };
  if (days < 60) return { Bucket: '30-59 days', Action: 'Reprice' };
  if (days < 90) return { Bucket: '60-89 days', Action: 'Bundle / discount' };
  if (days < 180) return { Bucket: '90-179 days', Action: 'Liquidation / auction' };
  return { Bucket: '180+ days', Action: 'Seller exit / disposal' };
}

// Products still in the warehouse with units left to sell.
async function getDeadStock(now = new Date()) {
  const assets = await Asset.find({ Status: { $nin: ['Sold', 'Archived'] }, QuantityAvailable: { $gt: 0 } }).lean();
  return assets
    .map((a) => {
      const DaysInStock = Math.floor((now - new Date(a.DateReceived)) / DAY_MS);
      return {
        AssetID: a.AssetID,
        ItemName: a.ItemName,
        Category: a.Category,
        SellerID: a.SellerID,
        SellerName: a.SellerName,
        Status: a.Status,
        DateReceived: a.DateReceived,
        QuantityAvailable: a.QuantityAvailable,
        ListedPrice: a.ListedPrice,
        DaysInStock,
        ...recommendation(DaysInStock),
      };
    })
    .sort((x, y) => y.DaysInStock - x.DaysInStock);
}

module.exports = { getDeadStock, recommendation };
