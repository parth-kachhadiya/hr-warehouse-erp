import { getDeadStock } from '../api/finance.api';
import useFetch from '../hooks/useFetch';
import DataTable from '../components/common/DataTable';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import Message from '../components/common/Message';
import { formatDate, formatINR } from '../utils/format';

const BUCKETS = ['0-29 days', '30-59 days', '60-89 days', '90-179 days', '180+ days'];

export default function DeadStock() {
  const { data, loading, error } = useFetch(getDeadStock);
  const count = (bucket) => (data || []).filter((d) => d.Bucket === bucket).length;

  return (
    <div className="page">
      <div className="page-header"><h1>Dead Stock</h1></div>
      <Message message={error ? { type: 'error', text: error } : null} />
      <div className="stats">
        {BUCKETS.map((b) => <StatCard key={b} label={b} value={count(b)} tone={b === '0-29 days' ? undefined : 'orange'} />)}
      </div>
      <DataTable
        rowKey="AssetID"
        rows={data}
        loading={loading}
        empty="No unsold stock."
        columns={[
          { key: 'AssetID', label: 'ID' },
          { key: 'ItemName', label: 'Item' },
          { key: 'SellerName', label: 'Seller' },
          { key: 'Status', label: 'Status', render: (d) => <StatusBadge status={d.Status} /> },
          { key: 'DateReceived', label: 'Received', render: (d) => formatDate(d.DateReceived) },
          { key: 'DaysInStock', label: 'Days', align: 'right' },
          { key: 'QuantityAvailable', label: 'Available', align: 'right' },
          { key: 'ListedPrice', label: 'Listed', align: 'right', render: (d) => formatINR(d.ListedPrice) },
          { key: 'Bucket', label: 'Age' },
          { key: 'Action', label: 'Suggested action', render: (d) => <StatusBadge status={d.Action} /> },
        ]}
      />
    </div>
  );
}
