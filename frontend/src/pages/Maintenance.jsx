import { useState } from 'react';
import { Ban, Wrench } from 'lucide-react';
import { addMaintenance, getAssets, getMaintenance, voidMaintenance } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, DataTable, Field, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';
import { fmt, formatDate } from '../utils/format';

const REPAIRABLE = ['In Stock', 'Listed', 'Damaged'];
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // yyyy-mm-dd
const EMPTY = { assetID: '', description: '', cost: '', date: today() };

export default function Maintenance() {
  const entries = useFetch(getMaintenance);
  const assets = useFetch(getAssets);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const modal = useModal();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const products = (assets.data || []).filter((a) => REPAIRABLE.includes(a.Status) && Number(a.QuantityAvailable) > 0);
  const selected = products.find((a) => a.AssetID === f.assetID);
  const units = selected ? Number(selected.QuantityAvailable) : 0;
  const cost = Number(f.cost) || 0;
  const perUnit = units ? Math.round((cost / units) * 100) / 100 : 0;
  const oldPrice = selected ? (Number(selected.ListedPrice) || 0) + (Number(selected.RepairCostPerUnit) || 0) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!f.assetID || !f.description.trim() || !(cost > 0)) {
      return setMsg({ err: true, text: 'Choose a product, describe the repair and enter its cost' });
    }
    setBusy(true);
    try {
      const r = await addMaintenance(f);
      setMsg({ text: `Saved ${r.maintenanceID}. Selling price is now ${fmt(oldPrice + r.costPerUnit)} per unit. The seller's share is unchanged.` });
      setF({ ...EMPTY, date: f.date });
      entries.reload();
      assets.reload();
    } catch (err) {
      setMsg({ err: true, text: `Error: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m) => {
    const reason = await modal.prompt(`Why are you voiding ${m.MaintenanceID}? The repair cost will be taken off the price again.`, { title: 'Void repair', type: 'textarea', confirmText: 'Void' });
    if (reason === null) return;
    voidMaintenance(m.MaintenanceID, reason)
      .then(() => { entries.reload(); assets.reload(); })
      .catch((err) => modal.alert(`Error: ${err.message}`));
  };

  const rows = entries.data || [];
  return (
    <>
      <PageHeader title="Maintenance" subtitle="Repairs on products. The repair cost is added to the selling price; the seller's share stays the same." />
      <Alert msg={msg || (entries.error && { err: true, text: entries.error })} />
      <form noValidate onSubmit={submit}>
        <Panel title="Add a repair"
          footer={<button className="btn btn-primary" disabled={busy}><Wrench size={16} />{busy ? 'Saving...' : 'Save Repair'}</button>}>
          <div className="form-grid">
            <Field label="Product" required span>
              <select value={f.assetID} onChange={set('assetID')}>
                <option value="">-- select product --</option>
                {products.map((a) => (
                  <option key={a.AssetID} value={a.AssetID}>{a.AssetID} — {a.ItemName} | Available {a.QuantityAvailable}</option>
                ))}
              </select>
            </Field>
            <Field label="What was repaired" required span>
              <input value={f.description} onChange={set('description')} placeholder="e.g. Replaced compressor" />
            </Field>
            <Field label="Repair cost (₹)" required hint={units > 1 ? `Spread over ${units} available units` : undefined}>
              <input type="number" min="0" inputMode="decimal" value={f.cost} onChange={set('cost')} />
            </Field>
            <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
          </div>
          {selected && cost > 0 && (
            <div className="summary" style={{ marginTop: 16 }}>
              <div><div className="k">Price now / unit</div><div className="v">{fmt(oldPrice)}</div></div>
              <div><div className="k">Repair / unit</div><div className="v">+ {fmt(perUnit)}</div></div>
              <div><div className="k">New price / unit</div><div className="v accent">{fmt(oldPrice + perUnit)}</div></div>
            </div>
          )}
        </Panel>
      </form>

      <Panel title="Repairs" flush>
        <DataTable rows={entries.data ? rows.length : -1} empty="No repairs yet"
          head={['ID', 'Date', 'Product', 'Repair', 'Cost', 'Units', 'Per Unit', '']}>
          {rows.map((m) => (
            <tr key={m.MaintenanceID}>
              <td className="id-cell">{m.MaintenanceID}</td>
              <td>{formatDate(m.Date)}</td>
              <td className="item-cell">{m.AssetID} · {m.ItemName}</td>
              <td className="wrap">{m.Description}</td>
              <td className="strong">{fmt(m.TotalCost)}</td>
              <td>{m.Units}</td>
              <td>{fmt(m.CostPerUnit)}</td>
              <td><button type="button" className="btn btn-sm btn-soft-red" onClick={() => remove(m)}><Ban size={14} />Void</button></td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
