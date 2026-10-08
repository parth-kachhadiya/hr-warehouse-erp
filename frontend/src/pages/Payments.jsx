import { HandCoins } from 'lucide-react';
import { getSales, recordPayment } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, Badge, DataTable, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';
import { fmt } from '../utils/format';

export default function Payments() {
  const { data, reload, error } = useFetch(getSales);
  const modal = useModal();
  const pending = (data || []).filter((s) => s.PaymentStatus !== 'Paid' && s.OrderStatus !== 'Cancelled');

  const collect = async (s, balance) => {
    const amt = await modal.prompt(`Amount received (balance: ${fmt(balance)})`, { title: `Collect payment · ${s.SaleID}`, type: 'number', defaultValue: balance, min: 0, confirmText: 'Record payment' });
    if (!amt) return;
    try {
      const result = await recordPayment({ saleID: s.SaleID, amount: amt, mode: 'Cash', notes: 'Balance payment' });
      reload();
      if (result && result.paymentStatus === 'Paid') modal.alert('Full payment received. Order is now Ready for Pickup.', { title: 'Payment complete' });
    } catch (e) {
      modal.alert(`Error: ${e.message}`);
    }
  };

  return (
    <>
      <PageHeader title="Payment Collection" subtitle="Sales with money still to collect from the buyer." />
      <Alert msg={error && { err: true, text: error }} />
      <Panel flush>
        <DataTable rows={data ? pending.length : -1} empty="No pending payments 🎉"
          head={['Sale ID', 'Buyer', 'Qty', 'Total ₹', 'Received ₹', 'Balance ₹', 'Status', '']}>
          {pending.map((s) => {
            const balance = Number(s.SalePrice) - Number(s.ReceivedAmount);
            return (
              <tr key={s.SaleID}>
                <td className="id-cell">{s.SaleID}</td>
                <td className="item-cell">{s.BuyerName || '-'}</td>
                <td>{s.Quantity || 1}</td>
                <td>{fmt(s.SalePrice)}</td>
                <td>{fmt(s.ReceivedAmount)}</td>
                <td className="strong">{fmt(balance)}</td>
                <td><Badge>{s.PaymentStatus}</Badge></td>
                <td><button className="btn btn-sm btn-soft-green" onClick={() => collect(s, balance)}><HandCoins size={14} />Collect</button></td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
    </>
  );
}
