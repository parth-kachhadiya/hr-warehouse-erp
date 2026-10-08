import { Archive, Image, PencilLine, Video } from 'lucide-react';
import { adjustAssetQuantity, deleteAsset, getAssets, setAssetStatus } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, Badge, DataTable, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';
import { fmt, safeUrl } from '../utils/format';
import { STOCK_STATUS_OPTIONS } from '../utils/constants';

export default function Stock() {
  const { data, reload, error } = useFetch(getAssets);
  const modal = useModal();
  const onErr = (e) => modal.alert(`Error: ${e.message}`);

  const adjustQty = async (a) => {
    const next = await modal.prompt(`New TOTAL received quantity for ${a.AssetID}:`, { title: 'Adjust quantity', type: 'number', defaultValue: a.QuantityReceived || 0, min: 1, step: 1 });
    if (next === null || next === '') return;
    const reason = await modal.prompt('Reason for quantity adjustment:', { title: 'Adjust quantity' });
    if (!reason) return;
    adjustAssetQuantity(a.AssetID, next, reason).then(reload).catch(onErr);
  };

  const archive = async (a) => {
    if (!(await modal.confirm('Archive remaining available units? Reserved units cannot be archived.', { title: 'Archive product', confirmText: 'Archive', danger: true }))) return;
    deleteAsset(a.AssetID).then(reload).catch(onErr);
  };

  const changeStatus = (a, status) => setAssetStatus(a.AssetID, status).then(reload).catch((e) => { modal.alert(e.message); reload(); });

  const rows = data || [];
  return (
    <>
      <PageHeader title="Stock" subtitle="Everything in the warehouse, with quantities and space used." />
      <Alert msg={error && { err: true, text: error }} />
      <Panel flush>
        <DataTable rows={data ? rows.length : -1} empty="No stock"
          head={['ID', 'Item', 'Category', 'Grade', 'Received', 'Available', 'Reserved', 'Delivered', 'Space/Unit', 'Occupied', 'Listed/Unit ₹', 'Status', 'Change Status', 'Media', 'Action']}>
          {rows.map((a) => {
            const occupied = (Number(a.SpaceSqFt) || 0) * ((Number(a.QuantityAvailable) || 0) + (Number(a.QuantityReserved) || 0));
            return (
              <tr key={a.AssetID}>
                <td className="id-cell">{a.AssetID}</td>
                <td className="item-cell">{a.ItemName}</td>
                <td>{a.Category}</td>
                <td>{a.ConditionGrade}</td>
                <td>{a.QuantityReceived || 0}</td>
                <td className="strong">{a.QuantityAvailable || 0}</td>
                <td>{a.QuantityReserved || 0}</td>
                <td>{a.QuantityDelivered || 0}</td>
                <td>{a.SpaceSqFt} sqft</td>
                <td>{occupied.toLocaleString('en-IN')} sqft</td>
                <td>{fmt(a.ListedPrice)}</td>
                <td><Badge>{a.Status}</Badge></td>
                <td>
                  {['Sold', 'Archived'].includes(a.Status) ? <span className="muted">Locked</span> : (
                    <select className="input" value={STOCK_STATUS_OPTIONS.includes(a.Status) ? a.Status : ''} onChange={(e) => changeStatus(a, e.target.value)}>
                      {!STOCK_STATUS_OPTIONS.includes(a.Status) && <option value="" disabled>{a.Status}</option>}
                      {STOCK_STATUS_OPTIONS.map((st) => <option key={st}>{st}</option>)}
                    </select>
                  )}
                </td>
                <td>
                  <div className="media-links">
                    {(a.PhotoLinks || []).map((l, i) => <a key={l} href={safeUrl(l)} target="_blank" rel="noopener noreferrer"><Image size={12} />P{i + 1}</a>)}
                    {a.VideoLink && <a href={safeUrl(a.VideoLink)} target="_blank" rel="noopener noreferrer"><Video size={12} />Video</a>}
                    {!(a.PhotoLinks || []).length && !a.VideoLink && <span className="muted">-</span>}
                  </div>
                </td>
                <td>
                  {a.Status === 'Sold' ? <span className="muted">Completed</span> : (
                    <div className="row-actions">
                      <button className="btn btn-sm btn-soft-brand" onClick={() => adjustQty(a)}><PencilLine size={14} />Adjust Qty</button>
                      <button className="btn btn-sm btn-soft-red" onClick={() => archive(a)}><Archive size={14} />Archive</button>
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
