import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createSale, getAssets, getBuyers, previewBilling } from '../api/erp.api';
import { Alert, Field, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';
import { fmt } from '../utils/format';

const EMPTY = { assetID: '', buyerID: '', qty: '1', price: '', received: '', marketing: '0', logistics: '0' };
// Selling price per unit = listed price + repair cost from Maintenance.
const ourPrice = (a) => (Number(a.ListedPrice) || 0) + (Number(a.RepairCostPerUnit) || 0);

export default function Billing() {
  const [f, setF] = useState(EMPTY);
  const [assets, setAssets] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const modal = useModal();
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  // Picking a product fills in its price; it can still be changed (bargaining).
  const pickAsset = (e) => {
    const a = assets.find((x) => x.AssetID === e.target.value);
    setF((cur) => ({ ...cur, assetID: e.target.value, price: a && ourPrice(a) ? String(ourPrice(a)) : '' }));
  };

  const loadForm = useCallback(() => {
    getAssets().then((rows) => setAssets(rows.filter((a) => ['In Stock', 'Listed'].includes(a.Status) && Number(a.QuantityAvailable) > 0)))
      .catch((e) => modal.alert(`Error: ${e.message}`));
    getBuyers().then(setBuyers).catch((e) => modal.alert(`Error: ${e.message}`));
  }, [modal]);

  useEffect(() => { loadForm(); }, [loadForm]);

  // Live preview: quantity x price, commission and seller share.
  useEffect(() => {
    const qty = Number(f.qty);
    const unitPrice = Number(f.price);
    if (!f.assetID || !qty || !unitPrice) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      previewBilling(f.assetID, qty, unitPrice)
        .then((p) => alive && setPreview(p))
        .catch((e) => alive && setPreview({ error: e.message }));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [f.assetID, f.qty, f.price]);

  const showPreview = Boolean(f.assetID && Number(f.qty) && Number(f.price)) && preview;
  const selected = assets.find((a) => a.AssetID === f.assetID);

  const submit = async (e) => {
    e.preventDefault();
    const qty = Math.floor(Number(f.qty));
    const unitPrice = Number(f.price);
    if (!f.assetID || !qty || qty < 1 || !unitPrice || unitPrice <= 0) {
      return setMsg({ err: true, text: 'Select product, quantity and unit sale price' });
    }
    if (selected && qty > Number(selected.QuantityAvailable)) {
      return setMsg({ err: true, text: `Only ${selected.QuantityAvailable} unit(s) available` });
    }
    const total = qty * unitPrice;
    const sale = {
      assetID: f.assetID, quantity: qty, unitSalePrice: unitPrice, buyerID: f.buyerID,
      receivedAmount: f.received || 0, marketingCharge: f.marketing || 0, logisticsCharge: f.logistics || 0,
      managerOverride: false,
    };
    const repairPerUnit = selected ? Number(selected.RepairCostPerUnit) || 0 : 0;
    if (selected && Number(selected.ReservePrice) > 0 && unitPrice - repairPerUnit < Number(selected.ReservePrice)) {
      const min = Number(selected.ReservePrice) + repairPerUnit;
      const ok = await modal.confirm(`Unit price ${fmt(unitPrice)} is below the minimum ${fmt(min)} (reserve${repairPerUnit ? ' + repair' : ''}). Manager override?`, { title: 'Below reserve price', confirmText: 'Override' });
      if (!ok) return;
      sale.managerOverride = true;
    }
    if (Number(sale.receivedAmount) > total) {
      return setMsg({ err: true, text: `Received/token amount cannot exceed total sale ${fmt(total)}` });
    }
    setBusy(true);
    try {
      const id = await createSale(sale);
      setMsg({ text: `Sale ${id} recorded — Qty ${qty}, Total ${fmt(total)}. Partial/unpaid = Reserved; fully paid = Ready for Pickup.` });
      setF((cur) => ({ ...cur, assetID: '', qty: '1', price: '', received: '' }));
      setPreview(null);
      loadForm();
    } catch (err) {
      setMsg({ err: true, text: `Error: ${err.message}` });
    } finally {
      setBusy(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <PageHeader title="Sell / Billing" subtitle="Create a sale. Units are reserved until the buyer collects them." />
      <Alert msg={msg} />
      <form noValidate onSubmit={submit} className="grid-2" style={{ alignItems: 'start' }}>
        <div>
          <Panel title="Product and buyer">
            <div className="form-grid">
              <Field label="Asset" required span>
                <select value={f.assetID} onChange={pickAsset}>
                  <option value="">-- select product --</option>
                  {assets.map((a) => (
                    <option key={a.AssetID} value={a.AssetID}>{a.AssetID} — {a.ItemName} | Available {a.QuantityAvailable} | {fmt(ourPrice(a))}/unit</option>
                  ))}
                </select>
              </Field>
              <Field label="Buyer" span>
                <select value={f.buyerID} onChange={set('buyerID')}>
                  <option value="">-- walk-in / none --</option>
                  {buyers.map((b) => <option key={b.BuyerID} value={b.BuyerID}>{b.Name} — {b.Phone || 'no phone'}</option>)}
                </select>
              </Field>
              <Field label="Quantity" required><input type="number" min="1" step="1" inputMode="numeric" value={f.qty} onChange={set('qty')} /></Field>
              <Field label="Unit Sale Price (₹)" required
                hint={selected && Number(selected.RepairCostPerUnit) ? `Listed ${fmt(selected.ListedPrice)} + repair ${fmt(selected.RepairCostPerUnit)}` : undefined}><input type="number" min="0.01" inputMode="decimal" value={f.price} onChange={set('price')} /></Field>
              <Field label="Received Now / Token (₹)" span><input type="number" min="0" inputMode="decimal" value={f.received} onChange={set('received')} /></Field>
            </div>
          </Panel>
          <Panel title="Charges" description="Added to HR revenue and taken from the seller's share.">
            <div className="form-grid">
              <Field label="Marketing Charge (₹)"><input type="number" inputMode="decimal" value={f.marketing} onChange={set('marketing')} /></Field>
              <Field label="Logistics Charge (₹)"><input type="number" inputMode="decimal" value={f.logistics} onChange={set('logistics')} /></Field>
            </div>
          </Panel>
        </div>

        <div style={{ position: 'sticky', top: 72 }}>
          <Panel title="Bill summary"
            footer={<button className="btn btn-primary" disabled={busy} style={{ width: '100%' }}><CheckCircle2 size={16} />{busy ? 'Recording...' : 'Confirm Sale'}</button>}>
            {!showPreview && <p className="muted" style={{ margin: 0 }}>Choose a product, quantity and price to see the bill.</p>}
            {showPreview && preview.error && <div className="alert alert-error" style={{ margin: 0 }}><AlertTriangle size={18} />{preview.error}</div>}
            {showPreview && !preview.error && (
              <>
                <div className="summary">
                  <div><div className="k">{preview.quantity} × {fmt(preview.unitSalePrice)}</div><div className="v accent">{fmt(preview.totalSalePrice)}</div></div>
                  {Number(preview.repairCharge) > 0 && <div><div className="k">Repair (back to HR)</div><div className="v">{fmt(preview.repairCharge)}</div></div>}
                  <div><div className="k">Commission ({(preview.commission.rate * 100).toFixed(0)}%)</div><div className="v">{fmt(preview.commission.amount)}</div></div>
                  <div><div className="k">Seller gets approx</div><div className="v">{fmt(preview.sellerGets)}</div></div>
                </div>
                {preview.belowReserve && (
                  <div className="alert alert-error" style={{ margin: '12px 0 0' }}><AlertTriangle size={18} />Unit price below reserve {fmt(preview.asset.ReservePrice)}{Number(preview.repairPerUnit) ? ` + repair ${fmt(preview.repairPerUnit)}` : ''}</div>
                )}
                <p className="field-hint" style={{ margin: '12px 0 0' }}>Other charges apply; storage is billed separately.</p>
              </>
            )}
          </Panel>
        </div>
      </form>
    </>
  );
}
