import { Ban, PackageCheck } from 'lucide-react';
import { getSales, markOrderDelivered, voidSale } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, Badge, DataTable, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';
import { fmt, formatDateTime } from '../utils/format';

export default function SalesOrders() {
  const { data, reload, error } = useFetch(getSales);
  const modal = useModal();
  const onErr = (e) => modal.alert(`Error: ${e.message}`);

  const deliver = async (s) => {
    const remaining = Math.max(0, (Number(s.Quantity) || 1) - (Number(s.DeliveredQty) || 0));
    if (remaining <= 0) return modal.alert('This order is already fully delivered.');
    const q = await modal.prompt(`How many units are being handed over now? Remaining: ${remaining}`, { title: `Deliver · ${s.SaleID}`, type: 'number', defaultValue: remaining, min: 1, max: remaining, step: 1, confirmText: 'Next' });
    if (q === null || q === '') return;
    const qty = Math.floor(Number(q));
    if (!qty || qty < 1 || qty > remaining) return modal.alert(`Enter a quantity from 1 to ${remaining}.`);
    if (!(await modal.confirm(`Confirm ${qty} unit(s) physically handed over for ${s.SaleID}?`, { title: 'Confirm delivery', confirmText: 'Confirm' }))) return;
    try {
      const result = await markOrderDelivered(s.SaleID, qty);
      reload();
      modal.alert(result.orderStatus === 'Delivered'
        ? 'Order fully Delivered.'
        : `${qty} unit(s) delivered. ${result.remainingQty} unit(s) still pending pickup.`, { title: 'Delivered' });
    } catch (e) {
      onErr(e);
    }
  };

  const cancel = async (s) => {
    const reason = await modal.prompt(`Reason for cancelling / voiding ${s.SaleID}:`, { title: 'Cancel order', type: 'textarea' });
    if (!reason) return;
    if (!(await modal.confirm('Cancel this order? Stock and balances will be reversed. Any received payment may require refund/credit handling.', { title: 'Cancel order', confirmText: 'Cancel order', danger: true }))) return;
    voidSale(s.SaleID, reason).then(reload).catch(onErr);
  };

  const rows = data || [];
  return (
    <>
      <PageHeader title="Sales / Orders" subtitle="Every active sale, its payment and its delivery." />
      <Alert msg={{ info: true, text: 'Payment and physical delivery are tracked separately. Token/partial payment keeps the item reserved; full payment makes it Ready for Pickup; staff marks it Delivered only when the item actually leaves the warehouse.' }} />
      <Alert msg={error && { err: true, text: error }} />
      <Panel flush>
        <DataTable rows={data ? rows.length : -1} empty="No sales yet"
          head={['Sale ID', 'Date', 'Item', 'Qty', 'Delivered', 'Unit ₹', 'Buyer', 'Total ₹', 'Received', 'Balance', 'Payment', 'Order', 'Action']}>
          {rows.map((s) => {
            const balance = Math.max(0, Number(s.SalePrice) - Number(s.ReceivedAmount));
            const orderStatus = s.OrderStatus || (s.PaymentStatus === 'Paid' ? 'Ready for Pickup' : 'Reserved');
            const delivered = Number(s.DeliveredQty) || 0;
            const canDeliver = ['Ready for Pickup', 'Partially Delivered'].includes(orderStatus) && s.PaymentStatus === 'Paid';
            const canCancel = delivered === 0 && orderStatus !== 'Delivered' && orderStatus !== 'Cancelled';
            return (
              <tr key={s.SaleID}>
                <td className="id-cell">{s.SaleID}</td>
                <td className="muted">{formatDateTime(s.Date)}</td>
                <td className="item-cell">{s.ItemName}</td>
                <td>{s.Quantity || 1}</td>
                <td>{delivered} / {s.Quantity || 1}</td>
                <td>{fmt(s.UnitSalePrice || Number(s.SalePrice) / (Number(s.Quantity) || 1))}</td>
                <td>{s.BuyerName || '-'}</td>
                <td className="strong">{fmt(s.SalePrice)}</td>
                <td>{fmt(s.ReceivedAmount)}</td>
                <td>{fmt(balance)}</td>
                <td><Badge>{s.PaymentStatus}</Badge></td>
                <td><Badge>{orderStatus}</Badge></td>
                <td>
                  {orderStatus === 'Delivered' ? <span className="muted">Completed</span> : (
                    <div className="row-actions">
                      {canDeliver && <button className="btn btn-sm btn-soft-green" onClick={() => deliver(s)}><PackageCheck size={14} />Deliver Qty</button>}
                      {canCancel && <button className="btn btn-sm btn-soft-red" onClick={() => cancel(s)}><Ban size={14} />Cancel / Void</button>}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </>
  );
}
