import { getAuditLog, getSystemHealth } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, DataTable, PageHeader, Panel } from '../components/common/ui';
import { formatDateTime } from '../utils/format';

const detailsText = (d) => (typeof d === 'string' ? d : JSON.stringify(d || {}));

export default function AuditLog() {
  const health = useFetch(getSystemHealth);
  const audit = useFetch(() => getAuditLog(150));
  const h = health.data;
  const rows = audit.data || [];
  return (
    <>
      <PageHeader title="Audit Log" subtitle="System health and the latest 150 actions." />
      {h && (h.ok
        ? <Alert msg={{ text: `ERP ${h.version} health OK · Timezone ${h.timezone}` }} />
        : <Alert msg={{ err: true, text: <>Health check found issues:<ul>{h.issues.map((i) => <li key={i}>{i}</li>)}</ul></> }} />)}
      <Alert msg={(health.error || audit.error) && { err: true, text: health.error || audit.error }} />
      <Panel flush>
        <DataTable rows={audit.data ? rows.length : -1} empty="No audit records yet" head={['Time', 'Actor', 'Action', 'Entity', 'ID', 'Details']}>
          {rows.map((r) => (
            <tr key={r.AuditID}>
              <td className="muted">{formatDateTime(r.Timestamp)}</td><td>{r.Actor}</td><td><span className="badge tone-brand">{r.Action}</span></td>
              <td>{r.EntityType}</td><td className="id-cell">{r.EntityID}</td>
              <td className="wrap">{detailsText(r.Details)}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
