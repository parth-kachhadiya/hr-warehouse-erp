import { listSellers } from '../api/sellers.api';
import { listSettlements, paySeller } from '../api/settlements.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import Message from '../components/common/Message';
import { useModal } from '../components/common/Modal';
import { PAYMENT_MODES } from '../utils/constants';
import { formatDateTime, formatINR } from '../utils/format';

export default function Settlements() {
  const data = useFetch(async () => {
    const [sellers, settlements] = await Promise.all([listSellers(true), listSettlements()]);
    return { sellers, settlements };
  });
  const { message, setMessage, run } = useAction();
  const modal = useModal();

  const pay = async (s) => {
    const values = await modal.form({
      title: `Pay seller · ${s.SellerID}`,
      message: `${s.Name}. Payable balance: ${formatINR(s.TotalPayable)}`,
      confirmText: 'Pay seller',
      fields: [
        { name: 'Amount', label: 'Amount (₹)', type: 'number', min: 0, defaultValue: Math.max(s.TotalPayable, 0) },
        { name: 'Mode', label: 'Mode', type: 'select', options: PAYMENT_MODES, defaultValue: 'Bank Transfer' },
        { name: 'Notes', label: 'Notes', required: false },
      ],
    });
    if (values && (await run(() => paySeller({ SellerID: s.SellerID, ...values }), `Paid ${formatINR(values.Amount)} to ${s.Name}`))) {
      data.reload({ silent: true });
    }
  };

  const sellers = (data.data?.sellers || []).filter((s) => s.Active || s.TotalPayable !== 0);

  return (
    <div className="page">
      <div className="page-header"><h1>Settlements</h1></div>
      <Message message={message || (data.error && { type: 'error', text: data.error })} onClose={() => setMessage(null)} />

      <section className="card">
        <h2>Seller balances</h2>
        <p className="muted small">Payable = sale amounts owed to the seller minus storage rent already deducted. It can be negative when rent is more than sales.</p>
        <DataTable
          rowKey="SellerID"
          rows={sellers}
          loading={data.loading}
          empty="No sellers yet."
          columns={[
            { key: 'SellerID', label: 'ID' },
            { key: 'Name', label: 'Seller' },
            { key: 'TotalPayable', label: 'Payable', align: 'right', render: (s) => <strong className={s.TotalPayable < 0 ? 'negative' : ''}>{formatINR(s.TotalPayable)}</strong> },
            { key: 'TotalSettled', label: 'Settled so far', align: 'right', render: (s) => formatINR(s.TotalSettled) },
            { key: 'actions', label: '', render: (s) => s.TotalPayable > 0 && <button className="btn btn-small" onClick={() => pay(s)}>Pay seller</button> },
          ]}
        />
      </section>

      <section className="card">
        <h2>Settlement history</h2>
        <DataTable
          rowKey="SettlementID"
          rows={data.data?.settlements}
          loading={data.loading}
          empty="No settlements yet."
          columns={[
            { key: 'SettlementID', label: 'ID' },
            { key: 'Date', label: 'Date', render: (s) => formatDateTime(s.Date) },
            { key: 'SellerName', label: 'Seller', render: (s) => `${s.SellerID} · ${s.SellerName}` },
            { key: 'Amount', label: 'Amount', align: 'right', render: (s) => formatINR(s.Amount) },
            { key: 'Mode', label: 'Mode' },
            { key: 'Notes', label: 'Notes' },
            { key: 'Status', label: 'Status', render: (s) => <StatusBadge status={s.Status} /> },
          ]}
        />
      </section>
    </div>
  );
}
