import { useState } from 'react';
import { addAsset, getWarehouseSpace } from '../api/assets.api';
import { listSellers } from '../api/sellers.api';
import { getSettings, listCategories, listCustomFields } from '../api/system.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import FormField from '../components/common/FormField';
import Message from '../components/common/Message';
import MediaUploader from '../components/common/MediaUploader';
import { CONDITION_GRADES } from '../utils/constants';
import { formatNumber } from '../utils/format';

const EMPTY = { ItemName: '', Category: '', SellerID: '', ConditionGrade: 'C', QuantityReceived: '1', SpaceSqFt: '', ReservePrice: '', ListedPrice: '', Notes: '' };

export default function AddProduct() {
  const lists = useFetch(async () => {
    const [sellers, categories, fields, space, settings] = await Promise.all([
      listSellers(), listCategories(), listCustomFields(), getWarehouseSpace(), getSettings(),
    ]);
    return { sellers, categories, fields, space, settings };
  });
  const { message, setMessage, run } = useAction();
  const [form, setForm] = useState(EMPTY);
  const [custom, setCustom] = useState({});
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const d = lists.data;
  const needed = (Number(form.SpaceSqFt) || 0) * (Number(form.QuantityReceived) || 0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const asset = await run(() => addAsset({ ...form, CustomFieldsData: custom }), (a) => `Product ${a.AssetID} added. You can now upload photos and video below.`);
    setBusy(false);
    if (asset) {
      setCreated(asset);
      setForm(EMPTY);
      setCustom({});
      lists.reload({ silent: true });
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Add Product</h1>
        {d && (
          <span className="muted">
            Warehouse: {formatNumber(d.space.used)} / {formatNumber(d.space.capacity)} sq.ft used ({formatNumber(d.space.utilization)}%)
          </span>
        )}
      </div>
      <Message message={message || (lists.error && { type: 'error', text: lists.error })} onClose={() => setMessage(null)} />

      <form className="card form-grid" onSubmit={submit}>
        <FormField label="Item name" required><input value={form.ItemName} onChange={set('ItemName')} required /></FormField>
        <FormField label="Category">
          <select value={form.Category} onChange={set('Category')}>
            <option value="">— Select —</option>
            {d?.categories.map((c) => <option key={c.CategoryID} value={c.Name}>{c.Name}</option>)}
          </select>
        </FormField>
        <FormField label="Seller">
          <select value={form.SellerID} onChange={set('SellerID')}>
            <option value="">— No seller —</option>
            {d?.sellers.map((s) => <option key={s.SellerID} value={s.SellerID}>{s.SellerID} · {s.Name}</option>)}
          </select>
        </FormField>
        <FormField label="Condition grade">
          <select value={form.ConditionGrade} onChange={set('ConditionGrade')}>
            {CONDITION_GRADES.map((g) => <option key={g}>{g}</option>)}
          </select>
        </FormField>
        <FormField label="Quantity" required><input type="number" min="1" step="1" value={form.QuantityReceived} onChange={set('QuantityReceived')} required /></FormField>
        <FormField label="Space per unit (sq.ft)" required hint={needed ? `Needs ${formatNumber(needed)} sq.ft in total` : undefined}>
          <input type="number" min="0" step="any" value={form.SpaceSqFt} onChange={set('SpaceSqFt')} required />
        </FormField>
        <FormField label="Reserve price per unit (₹)"><input type="number" min="0" step="any" value={form.ReservePrice} onChange={set('ReservePrice')} /></FormField>
        <FormField label="Listed price per unit (₹)"><input type="number" min="0" step="any" value={form.ListedPrice} onChange={set('ListedPrice')} /></FormField>
        {d?.fields.map((f) => (
          <FormField key={f.FieldID} label={f.FieldName}>
            <input value={custom[f.FieldName] || ''} onChange={(e) => setCustom((c) => ({ ...c, [f.FieldName]: e.target.value }))} />
          </FormField>
        ))}
        <FormField label="Notes" wide><textarea rows={2} value={form.Notes} onChange={set('Notes')} /></FormField>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add product'}</button>
        </div>
      </form>

      {created && (
        <section className="card">
          <h2>Photos & video for {created.AssetID} · {created.ItemName}</h2>
          <MediaUploader asset={created} onUpdated={setCreated} maxPhotoMB={d?.settings.MaxPhotoMB} maxVideoMB={d?.settings.MaxVideoMB} />
        </section>
      )}
    </div>
  );
}
