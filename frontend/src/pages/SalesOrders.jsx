import { useState } from 'react';
import { listSales } from '../api/sales.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import useSaleActions from '../hooks/useSaleActions';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import Message from '../components/common/Message';
import { useModal } from '../components/common/Modal';
import { ORDER_STATUSES } from '../utils/constants';
import { formatDateTime, formatINR } from '../utils/format';

export default function SalesOrders() {
  const [status, setStatus] = useState('');
  const sales = useFetch(() => listSales(status), [status]);
  const { message, setMessage, run } = useAction();
  const modal = useModal();
  const actions = useSaleActions({ modal, run, onDone: () => sales.reload({ silent: true }) });

  return (
    <div className="page">
      <div className="page-header"><h1>Sales / Orders</h1></div>
      <Message message={message || (sales.error && { type: 'error', text: sales.error })} onClose={() => setMessage(null)} />
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All orders</option>
          {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <DataTable
        rowKey="SaleID"
        rows={sales.data}
        loading={sales.loading}
        empty="No sales yet."
        columns={[
          { key: 'SaleID', label: 'Sale' },
          { key: 'Date', label: 'Date', render: (s) => formatDateTime(s.Date) },
          { key: 'ItemName', label: 'Item', render: (s) => (<>{s.ItemName}<div className="muted small">{s.AssetID}</div></>) },
          { key: 'Quantity', label: 'Qty', align: 'right', render: (s) => `${s.DeliveredQty}/${s.Quantity}` },
          { key: 'BuyerName', label: 'Buyer' },
          { key: 'SalePrice', label: 'Total', align: 'right', render: (s) => formatINR(s.SalePrice) },
          { key: 'ReceivedAmount', label: 'Received', align: 'right', render: (s) => formatINR(s.ReceivedAmount) },
          { key: 'balance', label: 'Balance', align: 'right', render: (s) => (s.TransactionStatus === 'Void' ? '—' : formatINR(actions.balance(s))) },
          { key: 'SellerPayable', label: 'Seller payable', align: 'right', render: (s) => formatINR(s.SellerPayable) },
          { key: 'PaymentStatus', label: 'Payment', render: (s) => <StatusBadge status={s.PaymentStatus} /> },
          { key: 'OrderStatus', label: 'Order', render: (s) => (<><StatusBadge status={s.OrderStatus} />{s.VoidReason && <div className="muted small">{s.VoidReason}</div>}</>) },
          {
            key: 'actions', label: 'Actions',
            render: (s) => (
              <div className="actions">
                {actions.canCollect(s) && <button className="btn btn-small" onClick={() => actions.collect(s)}>Collect</button>}
                {actions.canDeliver(s) && <button className="btn btn-small" onClick={() => actions.deliver(s)}>Deliver</button>}
                {actions.canCancel(s) && <button className="btn btn-small btn-danger-outline" onClick={() => actions.cancel(s)}>Cancel</button>}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
