import { useState } from 'react';
import { listAssets } from '../api/assets.api';
import { listBuyers } from '../api/buyers.api';
import { createSale, previewSale } from '../api/sales.api';
import useFetch from '../hooks/useFetch';
import FormField from '../components/common/FormField';
import Message from '../components/common/Message';
import { useModal } from '../components/common/Modal';
import { PAYMENT_MODES } from '../utils/constants';
import { formatINR, formatPercent } from '../utils/format';

const EMPTY = {
  AssetID: '', Quantity: '1', UnitSalePrice: '', BuyerID: '', ReceivedAmount: '0', PaymentMode: 'Cash',
  MarketingCharge: '0', RepairCharge: '0', LogisticsCharge: '0', Notes: '',
};

export default function Billing() {
  const lists = useFetch(async () => {
    const [assets, buyers] = await Promise.all([listAssets(), listBuyers()]);
    return { assets: assets.filter((a) => ['In Stock', 'Listed'].includes(a.Status) && a.QuantityAvailable > 0), buyers };
  });
  const modal = useModal();
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const assets = lists.data?.assets || [];
  const selected = assets.find((a) => a.AssetID === form.AssetID);

  const set = (key) => (e) => {
    const value = e.target.value;
    setPreview(null);
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'AssetID') {
        const a = assets.find((x) => x.AssetID === value);
        next.UnitSalePrice = a?.ListedPrice ? String(a.ListedPrice) : '';
      }
      return next;
    });
  };

  const doPreview = async () => {
    setMessage(null);
    try {
      setPreview(await previewSale(form));
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      let sale;
      try {
        sale = await createSale(form);
      } catch (err) {
        if (err.code !== 'RESERVE_OVERRIDE_REQUIRED') throw err;
        const approved = await modal.confirm(`${err.message} Approve this sale below reserve price?`, { title: 'Manager approval', confirmText: 'Approve & sell' });
        if (!approved) return;
        sale = await createSale({ ...form, managerOverride: true });
      }
      setMessage({ type: 'success', text: `Sale ${sale.SaleID} created · ${formatINR(sale.SalePrice)} · ${sale.PaymentStatus} · ${sale.OrderStatus}` });
      setForm(EMPTY);
      setPreview(null);
      lists.reload({ silent: true });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header"><h1>Sell / Billing</h1></div>
      <Message message={message || (lists.error && { type: 'error', text: lists.error })} onClose={() => setMessage(null)} />

      <div className="grid-2">
        <form className="card form-grid one-col" onSubmit={submit}>
          <FormField label="Product" required>
            <select value={form.AssetID} onChange={set('AssetID')} required>
              <option value="">— Select product —</option>
              {assets.map((a) => (
                <option key={a.AssetID} value={a.AssetID}>
                  {a.AssetID} · {a.ItemName} ({a.QuantityAvailable} available, {formatINR(a.ListedPrice)})
                </option>
              ))}
            </select>
          </FormField>
          {selected && (
            <p className="muted small">
              Seller: {selected.SellerName || '—'} · Reserve price: {formatINR(selected.ReservePrice)} · Listed: {formatINR(selected.ListedPrice)}
            </p>
          )}
          <div className="row-2">
            <FormField label="Quantity" required>
              <input type="number" min="1" max={selected?.QuantityAvailable} step="1" value={form.Quantity} onChange={set('Quantity')} required />
            </FormField>
            <FormField label="Unit sale price (₹)" required>
              <input type="number" min="0" step="any" value={form.UnitSalePrice} onChange={set('UnitSalePrice')} required />
            </FormField>
          </div>
          <FormField label="Buyer">
            <select value={form.BuyerID} onChange={set('BuyerID')}>
              <option value="">Walk-in</option>
              {lists.data?.buyers.map((b) => <option key={b.BuyerID} value={b.BuyerID}>{b.BuyerID} · {b.Name}</option>)}
            </select>
          </FormField>
          <div className="row-2">
            <FormField label="Amount received now (₹)"><input type="number" min="0" step="any" value={form.ReceivedAmount} onChange={set('ReceivedAmount')} /></FormField>
            <FormField label="Payment mode">
              <select value={form.PaymentMode} onChange={set('PaymentMode')}>{PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select>
            </FormField>
          </div>
          <div className="row-3">
            <FormField label="Marketing (₹)"><input type="number" min="0" step="any" value={form.MarketingCharge} onChange={set('MarketingCharge')} /></FormField>
            <FormField label="Repair (₹)"><input type="number" min="0" step="any" value={form.RepairCharge} onChange={set('RepairCharge')} /></FormField>
            <FormField label="Logistics (₹)"><input type="number" min="0" step="any" value={form.LogisticsCharge} onChange={set('LogisticsCharge')} /></FormField>
          </div>
          <FormField label="Notes"><textarea rows={2} value={form.Notes} onChange={set('Notes')} /></FormField>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={doPreview} disabled={!form.AssetID}>Preview</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create sale'}</button>
          </div>
        </form>

        <section className="card">
          <h2>Preview</h2>
          {!preview ? <p className="muted">Fill the form and press Preview to see the money split.</p> : (
            <>
              {preview.BelowReserve && (
                <div className="message message-warning">
                  Price is below the reserve price ({formatINR(preview.ReservePrice)}).{preview.NeedsOverride ? ' Manager approval will be asked.' : ''}
                </div>
              )}
              <table className="table compact">
                <tbody>
                  <tr><td>{preview.Quantity} × {formatINR(preview.UnitSalePrice)}</td><td className="num"><strong>{formatINR(preview.SalePrice)}</strong></td></tr>
                  <tr><td>Commission ({formatPercent(preview.CommissionRate)})</td><td className="num">{formatINR(preview.CommissionAmount)}</td></tr>
                  <tr><td>Marketing</td><td className="num">{formatINR(preview.MarketingCharge)}</td></tr>
                  <tr><td>Repair</td><td className="num">{formatINR(preview.RepairCharge)}</td></tr>
                  <tr><td>Logistics</td><td className="num">{formatINR(preview.LogisticsCharge)}</td></tr>
                  <tr className="total"><td>HR gross revenue</td><td className="num">{formatINR(preview.HRGrossRevenue)}</td></tr>
                  <tr className="total"><td>Seller payable</td><td className="num">{formatINR(preview.SellerPayable)}</td></tr>
                  <tr><td>Received now</td><td className="num">{formatINR(preview.ReceivedAmount)}</td></tr>
                  <tr><td>Balance due</td><td className="num">{formatINR(preview.Balance)}</td></tr>
                  <tr><td>Payment / order status</td><td className="num">{preview.PaymentStatus} · {preview.OrderStatus}</td></tr>
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
