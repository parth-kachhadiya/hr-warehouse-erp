import { getDeadStockReport } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, Badge, DataTable, PageHeader, Panel } from '../components/common/ui';

const toneFor = (days) => (days >= 180 ? 'violet' : days >= 90 ? 'red' : days >= 60 ? 'amber' : days >= 30 ? 'amber' : 'green');

export default function DeadStock() {
  const { data, error } = useFetch(getDeadStockReport);
  const rows = data || [];
  return (
    <>
      <PageHeader title="Dead Stock Report" subtitle="How long each product has been sitting, and what to do about it." />
      <Alert msg={error && { err: true, text: error }} />
      <Panel flush>
        <DataTable rows={data ? rows.length : -1} empty="No active stock"
          head={['Item', 'Available', 'Reserved', 'Physical Qty', 'Days in Stock', 'Bucket', 'Suggested Action']}>
          {rows.map((a) => (
            <tr key={a.AssetID}>
              <td className="item-cell">{a.ItemName}</td>
              <td>{a.QuantityAvailable || 0}</td>
              <td>{a.QuantityReserved || 0}</td>
              <td>{(Number(a.QuantityAvailable) || 0) + (Number(a.QuantityReserved) || 0)}</td>
              <td className="strong">{a.daysInStock}</td>
              <td><Badge tone={toneFor(a.daysInStock)}>{a.agingBucket}</Badge></td>
              <td>{a.suggestedAction}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
