// THE CORE: billing preview, create sale, collect payment, deliver, and void/cancel
// (same rules and messages as previewBilling / createSale / recordPayment /
// markOrderDelivered / voidSale in the old script). Each runs in one transaction,
// which replaces the old LockService + manual rollback.
const { Asset, Buyer, Seller, Sale, Payment, Reversal } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { num, text } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');
const inventory = require('./inventory.service');
const { calcCommission } = require('./commission.service');
const { getSettings } = require('./settings.service');

const ACTIVE_ASSET_STATUSES = ['In Stock', 'Listed'];

async function previewBilling(assetID, quantity, unitSalePrice) {
  const asset = await Asset.findOne({ AssetID: assetID }).lean();
  if (!asset) throw new AppError(404, 'Asset not found.');
  const qty = Math.floor(num(quantity, 'Quantity', { positive: true }));
  const available = Math.floor(Number(asset.QuantityAvailable) || 0);
  if (qty > available) throw new AppError(400, `Only ${available} unit(s) available.`);
  const unitPrice = num(unitSalePrice, 'Unit sale price', { positive: true });
  const total = qty * unitPrice;
  const commission = calcCommission(total, await getSettings());
  return {
    commission, asset, quantity: qty, unitSalePrice: unitPrice, totalSalePrice: total,
    belowReserve: Number(asset.ReservePrice) > 0 && unitPrice < Number(asset.ReservePrice),
  };
}

async function getSales() {
  return Sale.find({ TransactionStatus: { $ne: 'Void' } }).sort({ Date: 1, SaleID: 1 }).lean();
}

async function createSale(sale) {
  return withTransaction(async (session) => {
    if (!sale) throw new AppError(400, 'Sale data missing.');
    const asset = await Asset.findOne({ AssetID: sale.assetID }).session(session);
    if (!asset) throw new AppError(404, 'Asset not found.');
    if (!ACTIVE_ASSET_STATUSES.includes(asset.Status)) {
      throw new AppError(400, `Only In Stock or Listed products can be sold. Current status: ${asset.Status}.`);
    }

    const qty = Math.floor(num(sale.quantity, 'Quantity', { positive: true }));
    const available = Math.floor(Number(asset.QuantityAvailable) || 0);
    if (qty > available) throw new AppError(400, `Only ${available} unit(s) are available for this product.`);

    const unitPrice = num(sale.unitSalePrice, 'Unit sale price', { positive: true });
    const price = qty * unitPrice;
    const marketing = num(sale.marketingCharge || 0, 'Marketing charge', { nonnegative: true });
    const repair = num(sale.repairCharge || 0, 'Repair charge', { nonnegative: true });
    const logistics = num(sale.logisticsCharge || 0, 'Logistics charge', { nonnegative: true });
    const received = num(sale.receivedAmount || 0, 'Received amount', { nonnegative: true });
    if (received > price) throw new AppError(400, 'Received amount cannot exceed total sale price.');

    const reserve = Number(asset.ReservePrice) || 0;
    const settings = await getSettings(session);
    if (reserve > 0 && unitPrice < reserve && settings.RequireReservePriceApproval && sale.managerOverride !== true) {
      throw new AppError(400, `Unit sale price is below reserve price ${reserve}. Confirm manager override to continue.`);
    }

    let buyerName = '';
    if (sale.buyerID) {
      const buyer = await Buyer.findOne({ BuyerID: sale.buyerID, Active: true }).session(session);
      if (!buyer) throw new AppError(400, 'Buyer is not active.');
      buyerName = buyer.Name;
    }

    const commission = calcCommission(price, settings);
    const hrRevenue = commission.amount + marketing + repair + logistics;
    const sellerPayable = price - hrRevenue;
    if (sellerPayable < 0) throw new AppError(400, 'Charges exceed sale price.');

    const paymentStatus = received >= price ? 'Paid' : received > 0 ? 'Partial' : 'Unpaid';
    const orderStatus = paymentStatus === 'Paid' ? 'Ready for Pickup' : 'Reserved';
    const saleID = await nextId('SAL', session);

    await new Sale({
      SaleID: saleID, Date: new Date(), AssetID: asset.AssetID, ItemName: asset.ItemName,
      Quantity: qty, DeliveredQty: 0, UnitSalePrice: unitPrice,
      BuyerID: text(sale.buyerID), BuyerName: buyerName, SalePrice: price,
      CommissionRate: commission.rate, CommissionAmount: commission.amount, StorageCharge: 0,
      MarketingCharge: marketing, RepairCharge: repair, LogisticsCharge: logistics,
      HRGrossRevenue: hrRevenue, SellerPayable: sellerPayable, ReceivedAmount: received,
      PaymentStatus: paymentStatus, OrderStatus: orderStatus,
      Notes: text(sale.notes), TransactionStatus: 'Active',
    }).save({ session });

    if (received > 0) {
      await new Payment({
        PaymentID: await nextId('PAY', session), Date: new Date(), SaleID: saleID,
        BuyerID: text(sale.buyerID), BuyerName: buyerName, Amount: received,
        Mode: text(sale.paymentMode) || 'Cash', Notes: 'Initial payment / token at billing', Status: 'Active',
      }).save({ session });
    }

    asset.QuantityAvailable -= qty;
    asset.QuantityReserved += qty;
    await asset.save({ session });
    await inventory.recordMovement(asset.AssetID, asset.SellerID, 'RESERVE', 0, -qty, qty, 0, 0, saleID, 'Reserved for sale', null, session);

    if (asset.SellerID) await adjustSellerPayable(asset.SellerID, sellerPayable, session);
    if (sale.buyerID) await adjustBuyerTotal(sale.buyerID, price, session);

    await audit.log('SALE_CREATE', 'Sale', saleID, {
      assetID: asset.AssetID, quantity: qty, unitPrice, totalPrice: price,
      received, paymentStatus, orderStatus, sellerPayable, override: !!sale.managerOverride,
    }, session);
    return saleID;
  });
}

async function adjustSellerPayable(sellerID, delta, session) {
  const res = await Seller.updateOne({ SellerID: sellerID }, { $inc: { TotalPayable: Number(delta || 0) } }, { session });
  if (!res.matchedCount) throw new AppError(404, `Seller ${sellerID} not found.`);
}

async function adjustBuyerTotal(buyerID, delta, session) {
  const res = await Buyer.updateOne({ BuyerID: buyerID }, { $inc: { TotalPurchased: Number(delta || 0) } }, { session });
  if (!res.matchedCount) throw new AppError(404, 'Buyer not found.');
}

async function recordPayment(p = {}) {
  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ SaleID: p.saleID }).session(session);
    if (!sale) throw new AppError(404, 'Sale not found.');
    if ((sale.TransactionStatus || 'Active') === 'Void') throw new AppError(400, 'Cannot collect payment on a void sale.');
    const orderStatus = sale.OrderStatus || 'Reserved';
    if (orderStatus === 'Delivered') throw new AppError(400, 'This order is already delivered.');
    if (orderStatus === 'Cancelled') throw new AppError(400, 'This order is cancelled.');

    const price = Number(sale.SalePrice) || 0;
    const oldReceived = Number(sale.ReceivedAmount) || 0;
    const amount = num(p.amount, 'Payment amount', { positive: true });
    if (oldReceived + amount > price) throw new AppError(400, 'Payment exceeds remaining balance.');

    const newReceived = oldReceived + amount;
    const paymentStatus = newReceived >= price ? 'Paid' : 'Partial';
    const newOrderStatus = paymentStatus === 'Paid' ? 'Ready for Pickup' : 'Reserved';
    sale.ReceivedAmount = newReceived;
    sale.PaymentStatus = paymentStatus;
    sale.OrderStatus = newOrderStatus;
    await sale.save({ session });

    await new Payment({
      PaymentID: await nextId('PAY', session), Date: new Date(), SaleID: p.saleID,
      BuyerID: sale.BuyerID, BuyerName: sale.BuyerName, Amount: amount,
      Mode: text(p.mode) || 'Cash', Notes: text(p.notes) || 'Balance payment', Status: 'Active',
    }).save({ session });

    await audit.log('PAYMENT_RECEIVE', 'Sale', p.saleID, {
      amount, totalReceived: newReceived, paymentStatus, orderStatus: newOrderStatus,
    }, session);
    return { ok: true, paymentStatus, orderStatus: newOrderStatus, received: newReceived, balance: price - newReceived };
  });
}

async function markOrderDelivered(saleID, quantityToDeliver) {
  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ SaleID: saleID }).session(session);
    if (!sale) throw new AppError(404, 'Sale not found.');
    if ((sale.TransactionStatus || 'Active') === 'Void') throw new AppError(400, 'Cannot deliver a void sale.');
    const paymentStatus = sale.PaymentStatus || 'Unpaid';
    const orderStatus = sale.OrderStatus || 'Reserved';
    if (orderStatus === 'Delivered') throw new AppError(400, 'Order already fully delivered.');
    if (orderStatus === 'Cancelled') throw new AppError(400, 'Cancelled order cannot be delivered.');
    if (paymentStatus !== 'Paid') throw new AppError(400, 'Full payment is required before delivery.');

    const orderedQty = Math.max(1, Math.floor(Number(sale.Quantity) || 1));
    const alreadyDelivered = Math.max(0, Math.floor(Number(sale.DeliveredQty) || 0));
    const remaining = orderedQty - alreadyDelivered;
    if (remaining <= 0) throw new AppError(400, 'Nothing remains to deliver.');
    const qty = quantityToDeliver === undefined || quantityToDeliver === null || quantityToDeliver === ''
      ? remaining
      : Math.floor(num(quantityToDeliver, 'Delivery quantity', { positive: true }));
    if (qty > remaining) throw new AppError(400, `Only ${remaining} unit(s) remain on this order.`);

    const asset = await Asset.findOne({ AssetID: sale.AssetID }).session(session);
    if (!asset) throw new AppError(404, 'Linked asset not found.');
    const reserved = Math.floor(Number(asset.QuantityReserved) || 0);
    if (reserved < qty) throw new AppError(400, 'Reserved quantity mismatch. Run System Health Check.');

    const deliveredAt = new Date();
    const saleDelivered = alreadyDelivered + qty;
    const newOrderStatus = saleDelivered >= orderedQty ? 'Delivered' : 'Partially Delivered';
    const newReserved = reserved - qty;
    const newDelivered = (Number(asset.QuantityDelivered) || 0) + qty;
    const available = Number(asset.QuantityAvailable) || 0;
    const removed = Number(asset.QuantityRemoved) || 0;
    const receivedQty = Number(asset.QuantityReceived) || 0;
    const finalStatus = available === 0 && newReserved === 0 && newDelivered + removed >= receivedQty
      ? (removed > 0 ? 'Archived' : 'Sold')
      : (asset.Status === 'Sold' ? 'In Stock' : asset.Status);

    sale.DeliveredQty = saleDelivered;
    sale.OrderStatus = newOrderStatus;
    sale.DeliveredAt = deliveredAt;
    await sale.save({ session });
    asset.QuantityReserved = newReserved;
    asset.QuantityDelivered = newDelivered;
    asset.Status = finalStatus;
    asset.DateSold = finalStatus === 'Sold' ? deliveredAt : null;
    await asset.save({ session });
    await inventory.recordMovement(
      sale.AssetID, asset.SellerID, 'DELIVER', -qty, 0, -qty, qty, 0, saleID,
      `Physically delivered to buyer (${saleDelivered}/${orderedQty})`, deliveredAt, session
    );

    await audit.log('ORDER_DELIVERY', 'Sale', saleID, {
      assetID: sale.AssetID, quantityDeliveredNow: qty, totalDelivered: saleDelivered,
      orderedQty, orderStatus: newOrderStatus, deliveredAt: deliveredAt.getTime(),
    }, session);
    return {
      ok: true, orderStatus: newOrderStatus, deliveredQty: saleDelivered,
      remainingQty: orderedQty - saleDelivered, deliveredAt: deliveredAt.getTime(),
    };
  });
}

async function voidSale(saleID, reasonInput) {
  return withTransaction(async (session) => {
    const reason = text(reasonInput);
    if (!reason) throw new AppError(400, 'Void reason is required.');
    const sale = await Sale.findOne({ SaleID: saleID }).session(session);
    if (!sale) throw new AppError(404, 'Sale not found.');
    if ((sale.TransactionStatus || 'Active') === 'Void') throw new AppError(400, 'Sale already voided.');
    const orderStatus = sale.OrderStatus || 'Reserved';
    const deliveredQty = Math.max(0, Math.floor(Number(sale.DeliveredQty) || 0));
    if (deliveredQty > 0 || orderStatus === 'Delivered' || orderStatus === 'Partially Delivered') {
      throw new AppError(400, 'An order with delivered units cannot be voided directly. A return/refund workflow is required.');
    }

    const asset = await Asset.findOne({ AssetID: sale.AssetID }).session(session);
    if (!asset) throw new AppError(404, 'Linked asset not found.');
    const sellerID = asset.SellerID;
    const qty = Math.max(1, Math.floor(Number(sale.Quantity) || 1));
    const salePrice = Number(sale.SalePrice) || 0;
    const sellerPayable = Number(sale.SellerPayable) || 0;
    const received = Number(sale.ReceivedAmount) || 0;

    if (sellerID) {
      const seller = await Seller.findOne({ SellerID: sellerID }).session(session);
      if (seller && (Number(seller.TotalPayable) || 0) < sellerPayable) {
        throw new AppError(400, 'Seller payable has already been settled/adjusted below this sale amount.');
      }
    }
    const reserved = Number(asset.QuantityReserved) || 0;
    if (reserved < qty) throw new AppError(400, 'Reserved quantity mismatch; cannot safely cancel.');

    const cancelledAt = new Date();
    Object.assign(sale, {
      TransactionStatus: 'Void', VoidDate: cancelledAt, VoidReason: reason,
      PaymentStatus: 'Void', OrderStatus: 'Cancelled', CancelledAt: cancelledAt,
    });
    await sale.save({ session });
    asset.QuantityReserved = reserved - qty;
    asset.QuantityAvailable = (Number(asset.QuantityAvailable) || 0) + qty;
    asset.Status = asset.Status === 'Sold' ? 'In Stock' : asset.Status;
    asset.DateSold = null;
    await asset.save({ session });
    await inventory.recordMovement(sale.AssetID, sellerID, 'RELEASE', 0, qty, -qty, 0, 0, saleID, `Cancelled reservation: ${reason}`, cancelledAt, session);

    if (sellerID) await adjustSellerPayable(sellerID, -sellerPayable, session);
    if (sale.BuyerID) await adjustBuyerTotal(sale.BuyerID, -salePrice, session);
    await Payment.updateMany({ SaleID: saleID, Status: { $ne: 'Void' } }, { $set: { Status: 'Void' } }, { session });

    if (received > 0) await addReversal('Sale', saleID, received, reason, { type: 'buyer payment refund/credit required' }, session);
    await addReversal('Sale', saleID, salePrice, reason, { sellerPayableReversed: sellerPayable, quantityReleased: qty }, session);
    await audit.log('SALE_VOID', 'Sale', saleID, { reason, received, quantityReleased: qty }, session);
    return true;
  });
}

async function addReversal(entityType, entityID, amount, reason, details, session) {
  await new Reversal({
    ReversalID: await nextId('REV', session), Timestamp: new Date(), EntityType: entityType,
    EntityID: entityID, Amount: Number(amount) || 0, Reason: reason || '', Details: details || {},
  }).save({ session });
}

module.exports = { previewBilling, getSales, createSale, recordPayment, markOrderDelivered, voidSale, addReversal };
