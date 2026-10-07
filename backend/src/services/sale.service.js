// THE CORE: create a sale, collect payments, deliver, and void/cancel.
// Every write happens inside a transaction, so a failure undoes everything.
const { Asset, Buyer, Seller, Sale, Payment, Reversal } = require('../models');
const { nextId } = require('../utils/idGenerator');
const { withTransaction } = require('../utils/transaction');
const { toNumber, round2 } = require('../utils/number');
const AppError = require('../utils/AppError');
const audit = require('./audit.service');
const inventory = require('./inventory.service');
const { calculateSaleSplit } = require('./commission.service');
const { getSettings } = require('./settings.service');

const text = (v) => String(v ?? '').trim();

function paymentStatusFor(received, total) {
  if (received >= total) return 'Paid';
  if (received > 0) return 'Partial';
  return 'Unpaid';
}

function readCharge(value, label) {
  const n = toNumber(value, 0);
  if (!Number.isFinite(n) || n < 0) throw new AppError(400, `${label} must be 0 or more`);
  return round2(n);
}

// Checks the inputs and works out every number for a sale, without saving anything.
async function computeSale(input, session) {
  const settings = await getSettings(session);
  const asset = await Asset.findOne({ AssetID: text(input.AssetID) }).session(session || null);
  if (!asset) throw new AppError(404, 'Product not found');
  if (!['In Stock', 'Listed'].includes(asset.Status)) {
    throw new AppError(400, `Product status is "${asset.Status}". Only In Stock or Listed products can be sold.`);
  }
  const qty = toNumber(input.Quantity, NaN);
  if (!Number.isInteger(qty) || qty < 1) throw new AppError(400, 'Quantity must be a whole number of 1 or more');
  if (qty > asset.QuantityAvailable) throw new AppError(400, `Only ${asset.QuantityAvailable} unit(s) available`);
  const unitPrice = toNumber(input.UnitSalePrice, NaN);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new AppError(400, 'Unit sale price must be more than 0');

  const total = round2(qty * unitPrice);
  const received = readCharge(input.ReceivedAmount, 'Received amount');
  if (received > total) throw new AppError(400, 'Received amount cannot be more than the sale total');
  const marketing = readCharge(input.MarketingCharge, 'Marketing charge');
  const repair = readCharge(input.RepairCharge, 'Repair charge');
  const logistics = readCharge(input.LogisticsCharge, 'Logistics charge');

  let buyer = null;
  if (text(input.BuyerID)) {
    buyer = await Buyer.findOne({ BuyerID: text(input.BuyerID) }).session(session || null);
    if (!buyer) throw new AppError(404, 'Buyer not found');
    if (!buyer.Active) throw new AppError(400, 'Buyer is archived. Choose an active buyer.');
  }

  const belowReserve = asset.ReservePrice > 0 && unitPrice < asset.ReservePrice;
  const needsOverride = belowReserve && settings.RequireReservePriceApproval;
  const split = calculateSaleSplit({ total, marketing, repair, logistics }, settings);
  if (split.SellerPayable < 0) throw new AppError(400, 'Charges are more than the sale total, so the seller payable would be negative');

  const PaymentStatus = paymentStatusFor(received, total);
  return {
    asset, buyer, qty, unitPrice, total, received, marketing, repair, logistics,
    belowReserve, needsOverride, ...split, PaymentStatus,
    OrderStatus: PaymentStatus === 'Paid' ? 'Ready for Pickup' : 'Reserved',
  };
}

async function previewSale(input) {
  const c = await computeSale(input);
  return {
    AssetID: c.asset.AssetID,
    ItemName: c.asset.ItemName,
    Quantity: c.qty,
    UnitSalePrice: c.unitPrice,
    SalePrice: c.total,
    ReservePrice: c.asset.ReservePrice,
    BelowReserve: c.belowReserve,
    NeedsOverride: c.needsOverride,
    CommissionRate: c.CommissionRate,
    CommissionAmount: c.CommissionAmount,
    MarketingCharge: c.marketing,
    RepairCharge: c.repair,
    LogisticsCharge: c.logistics,
    HRGrossRevenue: c.HRGrossRevenue,
    SellerPayable: c.SellerPayable,
    ReceivedAmount: c.received,
    Balance: round2(c.total - c.received),
    PaymentStatus: c.PaymentStatus,
    OrderStatus: c.OrderStatus,
  };
}

// createSale: reserve the units, record the sale, first payment, and credit the seller.
async function createSale(input) {
  return withTransaction(async (session) => {
    const c = await computeSale(input, session);
    if (c.needsOverride && !(input.managerOverride === true || input.managerOverride === 'true')) {
      throw new AppError(
        409,
        `Unit price ₹${c.unitPrice} is below the reserve price ₹${c.asset.ReservePrice}. Manager approval is needed.`,
        'RESERVE_OVERRIDE_REQUIRED'
      );
    }
    const { asset, buyer } = c;
    const SaleID = await nextId('SAL', session);

    asset.QuantityAvailable -= c.qty;
    asset.QuantityReserved += c.qty;
    await asset.save({ session });
    await inventory.recordMovement(
      { asset, type: 'RESERVE', available: -c.qty, reserved: c.qty, saleId: SaleID, notes: 'Sale created' },
      session
    );

    const sale = await new Sale({
      SaleID,
      Date: new Date(),
      AssetID: asset.AssetID,
      ItemName: asset.ItemName,
      Quantity: c.qty,
      DeliveredQty: 0,
      UnitSalePrice: c.unitPrice,
      BuyerID: buyer ? buyer.BuyerID : '',
      BuyerName: buyer ? buyer.Name : 'Walk-in',
      SalePrice: c.total,
      CommissionRate: c.CommissionRate,
      CommissionAmount: c.CommissionAmount,
      StorageCharge: 0,
      MarketingCharge: c.marketing,
      RepairCharge: c.repair,
      LogisticsCharge: c.logistics,
      HRGrossRevenue: c.HRGrossRevenue,
      SellerPayable: c.SellerPayable,
      ReceivedAmount: c.received,
      PaymentStatus: c.PaymentStatus,
      OrderStatus: c.OrderStatus,
      Notes: text(input.Notes),
      TransactionStatus: 'Active',
    }).save({ session });

    if (c.received > 0) {
      const PaymentID = await nextId('PAY', session);
      await new Payment({
        PaymentID,
        Date: new Date(),
        SaleID,
        BuyerID: sale.BuyerID,
        BuyerName: sale.BuyerName,
        Amount: c.received,
        Mode: text(input.PaymentMode) || 'Cash',
        Notes: 'Initial payment at sale',
        Status: 'Active',
      }).save({ session });
    }

    if (asset.SellerID) {
      await Seller.updateOne({ SellerID: asset.SellerID }, { $inc: { TotalPayable: c.SellerPayable } }, { session });
    }
    if (buyer) {
      await Buyer.updateOne({ BuyerID: buyer.BuyerID }, { $inc: { TotalPurchased: c.total } }, { session });
    }

    await audit.log('CREATE_SALE', 'Sale', SaleID, {
      AssetID: asset.AssetID, Quantity: c.qty, SalePrice: c.total, SellerPayable: c.SellerPayable,
      managerOverride: c.needsOverride,
    }, session);
    return sale.toObject();
  });
}

async function listSales({ status } = {}) {
  const filter = {};
  if (status) filter.OrderStatus = status;
  return Sale.find(filter).sort({ SaleID: -1 }).lean();
}

// recordPayment: money received from the buyer against a sale.
async function recordPayment(saleId, input) {
  const amount = round2(toNumber(input.Amount, NaN));
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, 'Amount must be more than 0');
  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ SaleID: saleId }).session(session);
    if (!sale) throw new AppError(404, 'Sale not found');
    if (sale.TransactionStatus === 'Void' || ['Delivered', 'Cancelled'].includes(sale.OrderStatus)) {
      throw new AppError(400, `Cannot take payment on a ${sale.TransactionStatus === 'Void' ? 'void' : sale.OrderStatus.toLowerCase()} sale`);
    }
    const remaining = round2(sale.SalePrice - sale.ReceivedAmount);
    if (amount > remaining) throw new AppError(400, `Amount is more than the balance due (₹${remaining})`);

    sale.ReceivedAmount = round2(sale.ReceivedAmount + amount);
    sale.PaymentStatus = paymentStatusFor(sale.ReceivedAmount, sale.SalePrice);
    if (sale.PaymentStatus === 'Paid' && sale.OrderStatus === 'Reserved') sale.OrderStatus = 'Ready for Pickup';
    await sale.save({ session });

    const PaymentID = await nextId('PAY', session);
    const payment = await new Payment({
      PaymentID,
      Date: new Date(),
      SaleID: sale.SaleID,
      BuyerID: sale.BuyerID,
      BuyerName: sale.BuyerName,
      Amount: amount,
      Mode: text(input.Mode) || 'Cash',
      Notes: text(input.Notes),
      Status: 'Active',
    }).save({ session });

    await audit.log('RECORD_PAYMENT', 'Payment', PaymentID, { SaleID: sale.SaleID, Amount: amount }, session);
    return { sale: sale.toObject(), payment: payment.toObject() };
  });
}

// markOrderDelivered: hand units to the buyer (partial delivery allowed).
async function markOrderDelivered(saleId, input = {}) {
  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ SaleID: saleId }).session(session);
    if (!sale) throw new AppError(404, 'Sale not found');
    if (sale.TransactionStatus === 'Void' || sale.OrderStatus === 'Cancelled') throw new AppError(400, 'Sale is cancelled');
    if (sale.OrderStatus === 'Delivered') throw new AppError(400, 'Sale is already fully delivered');
    if (sale.PaymentStatus !== 'Paid') throw new AppError(400, 'Full payment is needed before delivery');

    const remaining = sale.Quantity - sale.DeliveredQty;
    const qty = input.Quantity === undefined || input.Quantity === '' || input.Quantity === null ? remaining : toNumber(input.Quantity, NaN);
    if (!Number.isInteger(qty) || qty < 1 || qty > remaining) {
      throw new AppError(400, `Delivery quantity must be a whole number from 1 to ${remaining}`);
    }

    const asset = await Asset.findOne({ AssetID: sale.AssetID }).session(session);
    if (!asset) throw new AppError(404, 'Product for this sale was not found');
    if (asset.QuantityReserved < qty) throw new AppError(400, 'Product does not have enough reserved units');
    asset.QuantityReserved -= qty;
    asset.QuantityDelivered += qty;
    inventory.finaliseIfEmpty(asset);
    await asset.save({ session });
    await inventory.recordMovement(
      { asset, type: 'DELIVER', physical: -qty, reserved: -qty, delivered: qty, saleId: sale.SaleID, notes: 'Delivered to buyer' },
      session
    );

    sale.DeliveredQty += qty;
    sale.OrderStatus = sale.DeliveredQty >= sale.Quantity ? 'Delivered' : 'Partially Delivered';
    sale.DeliveredAt = new Date();
    await sale.save({ session });

    await audit.log('DELIVER_ORDER', 'Sale', sale.SaleID, { Quantity: qty, DeliveredQty: sale.DeliveredQty, OrderStatus: sale.OrderStatus }, session);
    return sale.toObject();
  });
}

// voidSale: cancel a sale that has not been delivered and undo its effects.
async function voidSale(saleId, input = {}) {
  const reason = text(input.reason);
  if (!reason) throw new AppError(400, 'A reason is required to cancel a sale');
  return withTransaction(async (session) => {
    const sale = await Sale.findOne({ SaleID: saleId }).session(session);
    if (!sale) throw new AppError(404, 'Sale not found');
    if (sale.TransactionStatus === 'Void') throw new AppError(400, 'Sale is already void');
    if (sale.DeliveredQty > 0) throw new AppError(400, 'Cannot cancel: some units were already delivered');

    const asset = await Asset.findOne({ AssetID: sale.AssetID }).session(session);
    if (!asset) throw new AppError(404, 'Product for this sale was not found');
    const seller = asset.SellerID ? await Seller.findOne({ SellerID: asset.SellerID }).session(session) : null;
    if (seller && round2(seller.TotalPayable) < round2(sale.SellerPayable)) {
      throw new AppError(400, `Cannot cancel: seller payable (₹${round2(seller.TotalPayable)}) is less than this sale's seller payable (₹${sale.SellerPayable}). The seller may already have been paid.`);
    }

    const qty = sale.Quantity - sale.DeliveredQty;
    if (asset.QuantityReserved < qty) throw new AppError(400, 'Product does not have enough reserved units to release');
    asset.QuantityReserved -= qty;
    asset.QuantityAvailable += qty;
    await asset.save({ session });
    await inventory.recordMovement(
      { asset, type: 'RELEASE', available: qty, reserved: -qty, saleId: sale.SaleID, notes: `Sale cancelled: ${reason}` },
      session
    );

    const now = new Date();
    const refundDue = sale.ReceivedAmount;
    sale.TransactionStatus = 'Void';
    sale.PaymentStatus = 'Void';
    sale.OrderStatus = 'Cancelled';
    sale.CancelledAt = now;
    sale.VoidDate = now;
    sale.VoidReason = reason;
    await sale.save({ session });

    if (seller) {
      seller.TotalPayable = round2(seller.TotalPayable - sale.SellerPayable);
      await seller.save({ session });
    }
    if (sale.BuyerID) {
      await Buyer.updateOne({ BuyerID: sale.BuyerID }, { $inc: { TotalPurchased: -sale.SalePrice } }, { session });
    }
    await Payment.updateMany({ SaleID: sale.SaleID, Status: 'Active' }, { $set: { Status: 'Void' } }, { session });

    if (refundDue > 0) {
      await new Reversal({
        ReversalID: await nextId('REV', session),
        Timestamp: now,
        EntityType: 'Payment',
        EntityID: sale.SaleID,
        Amount: refundDue,
        Reason: `Refund due to buyer: ${reason}`,
        Details: { BuyerID: sale.BuyerID, BuyerName: sale.BuyerName, refundRequired: true },
      }).save({ session });
    }
    await new Reversal({
      ReversalID: await nextId('REV', session),
      Timestamp: now,
      EntityType: 'Sale',
      EntityID: sale.SaleID,
      Amount: sale.SalePrice,
      Reason: reason,
      Details: { AssetID: sale.AssetID, Quantity: qty, SellerPayable: sale.SellerPayable },
    }).save({ session });

    await audit.log('VOID_SALE', 'Sale', sale.SaleID, { reason, refundDue }, session);
    return sale.toObject();
  });
}

module.exports = { previewSale, createSale, listSales, recordPayment, markOrderDelivered, voidSale };
