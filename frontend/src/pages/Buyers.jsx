import { useState } from 'react';
import { Plus } from 'lucide-react';
import { addBuyer, getBuyers } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, DataTable, Field, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';
import { fmt } from '../utils/format';

const EMPTY = { name: '', phone: '', email: '' };

export default function Buyers() {
  const { data, reload, error } = useFetch(getBuyers);
  const [b, setB] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const modal = useModal();
  const set = (k) => (e) => setB({ ...b, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!b.name.trim()) return modal.alert('Name required');
    setBusy(true);
    try {
      await addBuyer(b);
      setB(EMPTY);
      reload();
    } catch (err) {
      modal.alert(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const rows = data || [];
  return (
    <>
      <PageHeader title="Buyers" subtitle="Customers who buy from the warehouse." />
      <Alert msg={error && { err: true, text: error }} />
      <form noValidate onSubmit={submit}>
        <Panel title="Add buyer" footer={<button className="btn btn-primary" disabled={busy}><Plus size={16} />{busy ? 'Saving...' : 'Add Buyer'}</button>}>
          <div className="form-grid">
            <Field label="Name" required><input value={b.name} onChange={set('name')} /></Field>
            <Field label="Phone"><input value={b.phone} onChange={set('phone')} inputMode="tel" /></Field>
            <Field label="Email"><input value={b.email} onChange={set('email')} type="email" /></Field>
          </div>
        </Panel>
      </form>
      <Panel title="All buyers" flush>
        <DataTable head={['ID', 'Name', 'Phone', 'Total Purchased ₹']} rows={data ? rows.length : -1} empty="No buyers yet">
          {rows.map((r) => (
            <tr key={r.BuyerID}>
              <td className="id-cell">{r.BuyerID}</td><td className="item-cell">{r.Name}</td><td>{r.Phone || '-'}</td><td className="strong">{fmt(r.TotalPurchased)}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
