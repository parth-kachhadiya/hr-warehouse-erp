import { listPayments, listReceivables } from '../api/payments.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import useSaleActions from '../hooks/useSaleActions';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import Message from '../components/common/Message';
import { useModal } from '../components/common/Modal';
import { formatDateTime, formatINR } from '../utils/format';

export default function Payments() {
  const data = useFetch(async () => {
    const [receivables, payments] = await Promise.all([listReceivables(), listPayments()]);
    return { receivables, payments };
  });
  const { message, setMessage, run } = useAction();
  const modal = useModal();
  const actions = useSaleActions({ modal, run, onDone: () => data.reload({ silent: true }) });
  const totalDue = (data.data?.receivables || []).reduce((sum, s) => sum + s.Balance, 0);

  return (
    <div className="page">
      <div className="page-header"><h1>Payments</h1></div>
      <Message message={message || (data.error && { type: 'error', text: data.error })} onClose={() => setMessage(null)} />

      <section className="card">
        <h2>Money due from buyers · {formatINR(totalDue)}</h2>
        <DataTable
          rowKey="SaleID"
          rows={data.data?.receivables}
          loading={data.loading}
          empty="Nothing due. All sales are paid."
          columns={[
            { key: 'SaleID', label: 'Sale' },
            { key: 'Date', label: 'Date', render: (s) => formatDateTime(s.Date) },
            { key: 'ItemName', label: 'Item' },
            { key: 'BuyerName', label: 'Buyer' },
            { key: 'SalePrice', label: 'Total', align: 'right', render: (s) => formatINR(s.SalePrice) },
            { key: 'ReceivedAmount', label: 'Received', align: 'right', render: (s) => formatINR(s.ReceivedAmount) },
            { key: 'Balance', label: 'Balance', align: 'right', render: (s) => <strong>{formatINR(s.Balance)}</strong> },
            { key: 'PaymentStatus', label: 'Status', render: (s) => <StatusBadge status={s.PaymentStatus} /> },
            { key: 'actions', label: '', render: (s) => actions.canCollect(s) && <button className="btn btn-small" onClick={() => actions.collect(s)}>Collect</button> },
          ]}
        />
      </section>

      <section className="card">
        <h2>Payment history</h2>
        <DataTable
          rowKey="PaymentID"
          rows={data.data?.payments}
          loading={data.loading}
          empty="No payments yet."
          columns={[
            { key: 'PaymentID', label: 'Payment' },
            { key: 'Date', label: 'Date', render: (p) => formatDateTime(p.Date) },
            { key: 'SaleID', label: 'Sale' },
            { key: 'BuyerName', label: 'Buyer' },
            { key: 'Amount', label: 'Amount', align: 'right', render: (p) => formatINR(p.Amount) },
            { key: 'Mode', label: 'Mode' },
            { key: 'Notes', label: 'Notes' },
            { key: 'Status', label: 'Status', render: (p) => <StatusBadge status={p.Status} /> },
          ]}
        />
      </section>
    </div>
  );
}
