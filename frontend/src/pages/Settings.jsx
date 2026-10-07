import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api/system.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import FormField from '../components/common/FormField';
import Message from '../components/common/Message';

export default function Settings() {
  const settings = useFetch(getSettings);
  const { message, setMessage, run } = useAction();
  const [form, setForm] = useState(null);

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setForm({
      WarehouseCapacitySqFt: s.WarehouseCapacitySqFt,
      RentedFootprintSqFt: s.RentedFootprintSqFt,
      StorageRatePerSqFtPerMonth: s.StorageRatePerSqFtPerMonth,
      CommissionPercent: Math.round(s.CommissionTier1Rate * 10000) / 100,
      RequireReservePriceApproval: s.RequireReservePriceApproval,
      EnforceWarehouseCapacity: s.EnforceWarehouseCapacity,
      MaxPhotoMB: s.MaxPhotoMB,
      MaxVideoMB: s.MaxVideoMB,
    });
  }, [settings.data]);

  if (!form) return <div className="page"><h1>Settings</h1><p className="muted">Loading…</p></div>;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const { CommissionPercent, ...rest } = form;
    const rate = Number(CommissionPercent) / 100;
    // As in the old system, one commission % is applied to all three tiers.
    const payload = { ...rest, CommissionTier1Rate: rate, CommissionTier2Rate: rate, CommissionTier3Rate: rate };
    const saved = await run(() => updateSettings(payload), 'Settings saved');
    if (saved) settings.setData(saved);
  };

  return (
    <div className="page">
      <div className="page-header"><h1>Settings</h1><span className="muted small">ERP version {settings.data?.ERPVersion}</span></div>
      <Message message={message || (settings.error && { type: 'error', text: settings.error })} onClose={() => setMessage(null)} />
      <form className="card form-grid" onSubmit={save}>
        <FormField label="Warehouse capacity (sq.ft)"><input type="number" min="0" step="any" value={form.WarehouseCapacitySqFt} onChange={set('WarehouseCapacitySqFt')} /></FormField>
        <FormField label="Rented footprint (sq.ft)"><input type="number" min="0" step="any" value={form.RentedFootprintSqFt} onChange={set('RentedFootprintSqFt')} /></FormField>
        <FormField label="Storage rate (₹ per sq.ft per month)"><input type="number" min="0" step="any" value={form.StorageRatePerSqFtPerMonth} onChange={set('StorageRatePerSqFtPerMonth')} /></FormField>
        <FormField label="Commission (%)" hint="Applied to all sale amounts"><input type="number" min="0" max="100" step="any" value={form.CommissionPercent} onChange={set('CommissionPercent')} /></FormField>
        <FormField label="Max photo size (MB)"><input type="number" min="1" step="1" value={form.MaxPhotoMB} onChange={set('MaxPhotoMB')} /></FormField>
        <FormField label="Max video size (MB)"><input type="number" min="1" step="1" value={form.MaxVideoMB} onChange={set('MaxVideoMB')} /></FormField>
        <label className="check field-wide">
          <input type="checkbox" checked={form.RequireReservePriceApproval} onChange={set('RequireReservePriceApproval')} />
          Ask for manager approval when selling below reserve price
        </label>
        <label className="check field-wide">
          <input type="checkbox" checked={form.EnforceWarehouseCapacity} onChange={set('EnforceWarehouseCapacity')} />
          Block new stock when the warehouse is full
        </label>
        <div className="form-actions"><button className="btn btn-primary">Save settings</button></div>
      </form>
    </div>
  );
}
