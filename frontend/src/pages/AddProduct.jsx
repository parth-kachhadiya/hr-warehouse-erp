import { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { addAsset, getCategories, getCustomFields, getSellers, uploadAssetMediaForAsset } from '../api/erp.api';
import { Alert, Field, PageHeader, Panel } from '../components/common/ui';
import { CONDITION_GRADES } from '../utils/constants';

const EMPTY = { itemName: '', category: '', conditionGrade: 'C', sellerID: '', quantity: '1', spaceSqFt: '', reservePrice: '', listedPrice: '', notes: '' };

export default function AddProduct() {
  const [f, setF] = useState(EMPTY);
  const [sellers, setSellers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [fields, setFields] = useState([]);
  const [custom, setCustom] = useState({});
  const [msg, setMsg] = useState(null);
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const photosRef = useRef(null);
  const videoRef = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    getSellers().then(setSellers).catch((e) => setMsg({ err: true, text: e.message }));
    getCategories().then((rows) => {
      setCategories(rows.length ? rows.map((c) => c.Name) : ['Other']);
      setF((cur) => ({ ...cur, category: cur.category || (rows[0] ? rows[0].Name : 'Other') }));
    }).catch((e) => setMsg({ err: true, text: e.message }));
    getCustomFields('Assets').then(setFields).catch(() => {});
  }, []);

  const totalSpace = (Number(f.quantity) || 0) * (Number(f.spaceSqFt) || 0);

  const submit = async (e) => {
    e.preventDefault();
    const qty = Number(f.quantity);
    const space = Number(f.spaceSqFt);
    if (!f.itemName.trim() || !qty || qty < 1 || !space || space <= 0) {
      return setMsg({ err: true, text: 'Item name, quantity and space per unit are required' });
    }
    setBusy(true);
    setProgress('Creating product...');
    const customFields = Object.fromEntries(Object.entries(custom).filter(([, v]) => v));
    let assetID;
    try {
      assetID = await addAsset({ ...f, quantity: qty, spaceSqFt: space, customFields });
    } catch (err) {
      setBusy(false);
      setProgress('');
      return setMsg({ err: true, text: `Error: ${err.message}` });
    }

    setProgress('Product saved. Uploading media...');
    const uploaded = [];
    try {
      for (const file of Array.from(photosRef.current.files)) {
        const r = await uploadAssetMediaForAsset(assetID, file);
        uploaded.push(r.fileName);
        setProgress(`Uploaded ${uploaded.length} media file(s)...`);
      }
      const video = videoRef.current.files[0];
      if (video) uploaded.push((await uploadAssetMediaForAsset(assetID, video)).fileName);
      setMsg({ text: `Saved ${assetID} — Qty ${qty}. ${uploaded.length ? `Media: ${uploaded.join(', ')}` : 'No media uploaded.'}` });
      setF((cur) => ({ ...EMPTY, category: cur.category, conditionGrade: cur.conditionGrade, sellerID: cur.sellerID }));
      setCustom({});
      photosRef.current.value = '';
      videoRef.current.value = '';
    } catch (err) {
      setMsg({ err: true, text: `Product ${assetID} saved, but some media upload failed: ${err.message}. You can continue using the product.` });
    } finally {
      setBusy(false);
      setProgress('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHeader title="Add Product" subtitle="Receive new stock into the warehouse." />
      <Alert msg={msg} />
      <form noValidate onSubmit={submit}>
        <Panel title="Product details">
          <div className="form-grid">
            <Field label="Item Name" required><input value={f.itemName} onChange={set('itemName')} placeholder="e.g. Steel Table" /></Field>
            <Field label="Category">
              <select value={f.category} onChange={set('category')}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="Condition Grade">
              <select value={f.conditionGrade} onChange={set('conditionGrade')}>{CONDITION_GRADES.map((g) => <option key={g}>{g}</option>)}</select>
            </Field>
            <Field label="Seller">
              <select value={f.sellerID} onChange={set('sellerID')}>
                <option value="">-- none --</option>
                {sellers.map((s) => <option key={s.SellerID} value={s.SellerID}>{s.Name} — {s.Phone || 'no phone'}</option>)}
              </select>
            </Field>
          </div>
        </Panel>

        <Panel title="Quantity, space and price">
          <div className="form-grid">
            <Field label="Quantity" required><input type="number" min="1" step="1" inputMode="numeric" value={f.quantity} onChange={set('quantity')} /></Field>
            <Field label="Space per Unit (sq.ft)" required><input type="number" min="0.01" step="0.01" inputMode="decimal" value={f.spaceSqFt} onChange={set('spaceSqFt')} /></Field>
            <Field label="Total Space"><div className="readout">{totalSpace.toLocaleString('en-IN')} sq.ft</div></Field>
            <Field label="Reserve Price / Unit (₹)"><input type="number" min="0" inputMode="decimal" value={f.reservePrice} onChange={set('reservePrice')} /></Field>
            <Field label="Listed Price / Unit (₹)"><input type="number" min="0" inputMode="decimal" value={f.listedPrice} onChange={set('listedPrice')} /></Field>
          </div>
        </Panel>

        <Panel title="Photos, video and notes" description="Saved as HR Warehouse Media → SellerID - Seller Name → Images / Video, named Product_Name_001, 002...">
          <div className="form-grid">
            <Field label="Photos (multiple allowed)"><input ref={photosRef} type="file" accept="image/*" multiple /></Field>
            <Field label="Video (optional)"><input ref={videoRef} type="file" accept="video/*" /></Field>
            {fields.map((fd) => (
              <Field key={fd.FieldID} label={fd.FieldName}>
                <input value={custom[fd.FieldName] || ''} onChange={(e) => setCustom({ ...custom, [fd.FieldName]: e.target.value })} />
              </Field>
            ))}
            <Field label="Notes" span><textarea rows={3} value={f.notes} onChange={set('notes')} /></Field>
          </div>
        </Panel>

        <div className="panel">
          <div className="panel-footer" style={{ borderTop: 0, borderRadius: 'var(--radius)' }}>
            <span className="muted">{progress}</span>
            <button className="btn btn-primary" disabled={busy}><Save size={16} />{busy ? 'Saving...' : 'Save Product'}</button>
          </div>
        </div>
      </form>
    </>
  );
}
