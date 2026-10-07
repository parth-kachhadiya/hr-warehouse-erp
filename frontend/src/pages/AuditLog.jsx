import { listAudit } from '../api/audit.api';
import useFetch from '../hooks/useFetch';
import DataTable from '../components/common/DataTable';
import Message from '../components/common/Message';
import { formatDateTime } from '../utils/format';

const details = (d) => {
  if (!d || typeof d !== 'object') return String(d ?? '');
  return Object.entries(d).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
};

export default function AuditLog() {
  const { data, loading, error, reload } = useFetch(listAudit);
  return (
    <div className="page">
      <div className="page-header">
        <h1>Audit Log</h1>
        <button className="btn btn-secondary" onClick={() => reload()}>Refresh</button>
      </div>
      <p className="muted small">Last 150 actions, newest first.</p>
      <Message message={error ? { type: 'error', text: error } : null} />
      <DataTable
        rowKey="AuditID"
        rows={data}
        loading={loading}
        empty="No activity yet."
        columns={[
          { key: 'AuditID', label: 'ID' },
          { key: 'Timestamp', label: 'Time', render: (r) => formatDateTime(r.Timestamp) },
          { key: 'Actor', label: 'By' },
          { key: 'Action', label: 'Action' },
          { key: 'EntityType', label: 'Type' },
          { key: 'EntityID', label: 'Record' },
          { key: 'Details', label: 'Details', render: (r) => <span className="small">{details(r.Details)}</span> },
        ]}
      />
    </div>
  );
}
