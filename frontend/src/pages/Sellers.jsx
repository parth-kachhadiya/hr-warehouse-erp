import { useState } from 'react';
import { Plus } from 'lucide-react';
import { addSeller, getSellers } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, DataTable, Field, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';
import { fmt } from '../utils/format';

const EMPTY = { name: '', phone: '', email: '', address: '', gstin: '' };

export default function Sellers() {
  const { data, reload, error } = useFetch(getSellers);
  const [s, setS] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const modal = useModal();
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!s.name.trim()) return modal.alert('Name required');
    setBusy(true);
    try {
      await addSeller(s);
      setS(EMPTY);
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
      <PageHeader title="Sellers" subtitle="People who store goods in the warehouse." />
      <Alert msg={error && { err: true, text: error }} />
      <form noValidate onSubmit={submit}>
        <Panel title="Add seller" footer={<button className="btn btn-primary" disabled={busy}><Plus size={16} />{busy ? 'Saving...' : 'Add Seller'}</button>}>
          <div className="form-grid">
            <Field label="Name" required><input value={s.name} onChange={set('name')} /></Field>
            <Field label="Phone"><input value={s.phone} onChange={set('phone')} inputMode="tel" /></Field>
            <Field label="Email"><input value={s.email} onChange={set('email')} type="email" /></Field>
            <Field label="Address"><input value={s.address} onChange={set('address')} /></Field>
            <Field label="GSTIN"><input value={s.gstin} onChange={set('gstin')} /></Field>
          </div>
        </Panel>
      </form>
      <Panel title="All sellers" flush>
        <DataTable head={['ID', 'Name', 'Phone', 'Payable ₹', 'Settled ₹']} rows={data ? rows.length : -1} empty="No sellers yet">
          {rows.map((r) => (
            <tr key={r.SellerID}>
              <td className="id-cell">{r.SellerID}</td><td className="item-cell">{r.Name}</td><td>{r.Phone || '-'}</td>
              <td className="strong">{fmt(r.TotalPayable)}</td><td>{fmt(r.TotalSettled)}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
