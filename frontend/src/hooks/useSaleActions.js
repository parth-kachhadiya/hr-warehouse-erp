// The three popup actions on a sale: collect payment, deliver, cancel.
// Shared by the Sales/Orders and Payments pages.
import { deliverOrder, recordPayment, voidSale } from '../api/sales.api';
import { PAYMENT_MODES } from '../utils/constants';
import { formatINR } from '../utils/format';

export default function useSaleActions({ modal, run, onDone }) {
  const balance = (s) => Math.round((s.SalePrice - s.ReceivedAmount) * 100) / 100;

  const collect = async (s) => {
    const values = await modal.form({
      title: `Collect payment · ${s.SaleID}`,
      message: `${s.ItemName} · ${s.BuyerName}. Balance due: ${formatINR(balance(s))}`,
      confirmText: 'Record payment',
      fields: [
        { name: 'Amount', label: 'Amount (₹)', type: 'number', min: 0, defaultValue: balance(s) },
        { name: 'Mode', label: 'Mode', type: 'select', options: PAYMENT_MODES, defaultValue: 'Cash' },
        { name: 'Notes', label: 'Notes', required: false },
      ],
    });
    if (values && (await run(() => recordPayment(s.SaleID, values), `Payment of ${formatINR(values.Amount)} recorded on ${s.SaleID}`))) onDone();
  };

  const deliver = async (s) => {
    const remaining = s.Quantity - s.DeliveredQty;
    const qty = await modal.prompt(`How many units to deliver now? (${remaining} remaining)`, {
      title: `Deliver · ${s.SaleID}`, type: 'number', defaultValue: remaining, min: 1, max: remaining, step: 1, confirmText: 'Deliver',
    });
    if (qty === null) return;
    if (await run(() => deliverOrder(s.SaleID, Number(qty)), `${qty} unit(s) delivered on ${s.SaleID}`)) onDone();
  };

  const cancel = async (s) => {
    const reason = await modal.prompt(
      `Cancel ${s.SaleID}? Units go back to stock, the seller's payable is reduced${s.ReceivedAmount > 0 ? ` and ${formatINR(s.ReceivedAmount)} must be refunded to the buyer` : ''}. Enter a reason:`,
      { title: 'Cancel sale', type: 'textarea', confirmText: 'Cancel sale', danger: true }
    );
    if (reason === null) return;
    if (await run(() => voidSale(s.SaleID, reason), `${s.SaleID} cancelled`)) onDone();
  };

  const canCollect = (s) => s.TransactionStatus === 'Active' && !['Delivered', 'Cancelled'].includes(s.OrderStatus) && balance(s) > 0;
  const canDeliver = (s) => s.TransactionStatus === 'Active' && s.PaymentStatus === 'Paid' && !['Delivered', 'Cancelled'].includes(s.OrderStatus);
  const canCancel = (s) => s.TransactionStatus === 'Active' && s.DeliveredQty === 0;

  return { collect, deliver, cancel, canCollect, canDeliver, canCancel, balance };
}
