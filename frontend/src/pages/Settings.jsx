import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { getSettings, updateSettings } from '../api/erp.api';
import { Alert, Field, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';

export default function Settings() {
  const [s, setS] = useState({ capacity: '', footprint: '', storage: '', commission: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const modal = useModal();
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });

  useEffect(() => {
    getSettings().then((x) => setS({
      capacity: x.WarehouseCapacitySqFt || '',
      footprint: x.RentedFootprintSqFt || '',
      storage: x.StorageRatePerSqFtPerMonth || '',
      commission: Math.round((x.CommissionTier3Rate || 0.1) * 100 * 1000) / 1000,
    })).catch((e) => setError(e.message));
  }, []);

  // One commission rate is written to all three tiers, as in the old system.
  const save = (e) => {
    e.preventDefault();
    const rate = Number(s.commission) / 100;
    setBusy(true);
    updateSettings({
      WarehouseCapacitySqFt: s.capacity, RentedFootprintSqFt: s.footprint, StorageRatePerSqFtPerMonth: s.storage,
      CommissionTier1Rate: rate, CommissionTier2Rate: rate, CommissionTier3Rate: rate,
    }).then(() => modal.alert('Settings saved', { title: 'Saved' })).catch((err) => modal.alert(`Error: ${err.message}`)).finally(() => setBusy(false));
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Warehouse size, storage rate and commission." />
      <Alert msg={error && { err: true, text: error }} />
      <form noValidate onSubmit={save}>
        <Panel title="Warehouse" footer={<button className="btn btn-primary" disabled={busy}><Save size={16} />{busy ? 'Saving...' : 'Save Settings'}</button>}>
          <div className="form-grid">
            <Field label="Warehouse Effective Capacity (sq.ft)"><input type="number" inputMode="decimal" value={s.capacity} onChange={set('capacity')} /></Field>
            <Field label="Rented Footprint (sq.ft)"><input type="number" inputMode="decimal" value={s.footprint} onChange={set('footprint')} /></Field>
            <Field label="Storage Rate (₹/sq.ft/month)"><input type="number" inputMode="decimal" value={s.storage} onChange={set('storage')} /></Field>
            <Field label="Commission Rate (%)"><input type="number" step="0.1" inputMode="decimal" value={s.commission} onChange={set('commission')} /></Field>
          </div>
        </Panel>
      </form>
    </>
  );
}
