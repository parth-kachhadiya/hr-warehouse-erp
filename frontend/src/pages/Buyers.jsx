import { useState } from 'react';
import { archiveBuyer, createBuyer, listBuyers, updateBuyer } from '../api/buyers.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import DataTable from '../components/common/DataTable';
import FormField from '../components/common/FormField';
import Message from '../components/common/Message';
import StatusBadge from '../components/common/StatusBadge';
import { useModal } from '../components/common/Modal';
import { formatDate, formatINR } from '../utils/format';

const EMPTY = { Name: '', Phone: '', Email: '', Address: '', GSTIN: '' };

export default function Buyers() {
  const [showArchived, setShowArchived] = useState(false);
  const buyers = useFetch(() => listBuyers(showArchived), [showArchived]);
  const { message, setMessage, run } = useAction();
  const modal = useModal();
  const [form, setForm] = useState(EMPTY);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const refresh = () => buyers.reload({ silent: true });

  const submit = async (e) => {
    e.preventDefault();
    if (await run(() => createBuyer(form), (b) => `Buyer ${b.BuyerID} added`)) {
      setForm(EMPTY);
      refresh();
    }
  };

  const edit = async (b) => {
    const values = await modal.form({
      title: `Edit ${b.BuyerID}`,
      confirmText: 'Save',
      fields: [
        { name: 'Name', label: 'Name', defaultValue: b.Name },
        { name: 'Phone', label: 'Phone', required: false, defaultValue: b.Phone },
        { name: 'Email', label: 'Email', required: false, defaultValue: b.Email },
        { name: 'Address', label: 'Address', type: 'textarea', required: false, defaultValue: b.Address },
        { name: 'GSTIN', label: 'GSTIN', required: false, defaultValue: b.GSTIN },
      ],
    });
    if (values && (await run(() => updateBuyer(b.BuyerID, values), `${b.BuyerID} updated`))) refresh();
  };

  const archive = async (b) => {
    if (!(await modal.confirm(`Archive buyer ${b.BuyerID} (${b.Name})?`, { confirmText: 'Archive', danger: true }))) return;
    if (await run(() => archiveBuyer(b.BuyerID), `${b.BuyerID} archived`)) refresh();
  };

  return (
    <div className="page">
      <div className="page-header"><h1>Buyers</h1></div>
      <Message message={message || (buyers.error && { type: 'error', text: buyers.error })} onClose={() => setMessage(null)} />

      <form className="card form-grid" onSubmit={submit}>
        <FormField label="Name" required><input value={form.Name} onChange={set('Name')} required /></FormField>
        <FormField label="Phone"><input value={form.Phone} onChange={set('Phone')} /></FormField>
        <FormField label="Email"><input type="email" value={form.Email} onChange={set('Email')} /></FormField>
        <FormField label="GSTIN"><input value={form.GSTIN} onChange={set('GSTIN')} /></FormField>
        <FormField label="Address" wide><textarea rows={2} value={form.Address} onChange={set('Address')} /></FormField>
        <div className="form-actions"><button className="btn btn-primary">Add buyer</button></div>
      </form>

      <div className="toolbar">
        <label className="check"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
      </div>
      <DataTable
        rowKey="BuyerID"
        rows={buyers.data}
        loading={buyers.loading}
        columns={[
          { key: 'BuyerID', label: 'ID' },
          { key: 'Name', label: 'Name' },
          { key: 'Phone', label: 'Phone' },
          { key: 'Email', label: 'Email' },
          { key: 'GSTIN', label: 'GSTIN' },
          { key: 'JoinDate', label: 'Joined', render: (b) => formatDate(b.JoinDate) },
          { key: 'TotalPurchased', label: 'Total purchased', align: 'right', render: (b) => formatINR(b.TotalPurchased) },
          { key: 'Active', label: 'Status', render: (b) => <StatusBadge status={b.Active ? 'Active' : 'Archived'} /> },
          {
            key: 'actions', label: 'Actions',
            render: (b) => b.Active && (
              <div className="actions">
                <button className="btn btn-small" onClick={() => edit(b)}>Edit</button>
                <button className="btn btn-small btn-danger-outline" onClick={() => archive(b)}>Archive</button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
