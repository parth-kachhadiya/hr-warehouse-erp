import { useState } from 'react';
import { archiveSeller, createSeller, listSellers, updateSeller } from '../api/sellers.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import DataTable from '../components/common/DataTable';
import FormField from '../components/common/FormField';
import Message from '../components/common/Message';
import StatusBadge from '../components/common/StatusBadge';
import { useModal } from '../components/common/Modal';
import { KYC_STATUSES } from '../utils/constants';
import { formatDate, formatINR } from '../utils/format';

const EMPTY = { Name: '', Phone: '', Email: '', Address: '', GSTIN: '', KYCStatus: 'Pending' };

export default function Sellers() {
  const [showArchived, setShowArchived] = useState(false);
  const sellers = useFetch(() => listSellers(showArchived), [showArchived]);
  const { message, setMessage, run } = useAction();
  const modal = useModal();
  const [form, setForm] = useState(EMPTY);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const refresh = () => sellers.reload({ silent: true });

  const submit = async (e) => {
    e.preventDefault();
    if (await run(() => createSeller(form), (s) => `Seller ${s.SellerID} added`)) {
      setForm(EMPTY);
      refresh();
    }
  };

  const edit = async (s) => {
    const values = await modal.form({
      title: `Edit ${s.SellerID}`,
      confirmText: 'Save',
      fields: [
        { name: 'Name', label: 'Name', defaultValue: s.Name },
        { name: 'Phone', label: 'Phone', required: false, defaultValue: s.Phone },
        { name: 'Email', label: 'Email', required: false, defaultValue: s.Email },
        { name: 'Address', label: 'Address', type: 'textarea', required: false, defaultValue: s.Address },
        { name: 'GSTIN', label: 'GSTIN', required: false, defaultValue: s.GSTIN },
        { name: 'KYCStatus', label: 'KYC status', type: 'select', options: KYC_STATUSES, defaultValue: s.KYCStatus },
      ],
    });
    if (values && (await run(() => updateSeller(s.SellerID, values), `${s.SellerID} updated`))) refresh();
  };

  const archive = async (s) => {
    if (!(await modal.confirm(`Archive seller ${s.SellerID} (${s.Name})?`, { confirmText: 'Archive', danger: true }))) return;
    if (await run(() => archiveSeller(s.SellerID), `${s.SellerID} archived`)) refresh();
  };

  return (
    <div className="page">
      <div className="page-header"><h1>Sellers</h1></div>
      <Message message={message || (sellers.error && { type: 'error', text: sellers.error })} onClose={() => setMessage(null)} />

      <form className="card form-grid" onSubmit={submit}>
        <FormField label="Name" required><input value={form.Name} onChange={set('Name')} required /></FormField>
        <FormField label="Phone"><input value={form.Phone} onChange={set('Phone')} /></FormField>
        <FormField label="Email"><input type="email" value={form.Email} onChange={set('Email')} /></FormField>
        <FormField label="GSTIN"><input value={form.GSTIN} onChange={set('GSTIN')} /></FormField>
        <FormField label="KYC status">
          <select value={form.KYCStatus} onChange={set('KYCStatus')}>{KYC_STATUSES.map((k) => <option key={k}>{k}</option>)}</select>
        </FormField>
        <FormField label="Address" wide><textarea rows={2} value={form.Address} onChange={set('Address')} /></FormField>
        <div className="form-actions"><button className="btn btn-primary">Add seller</button></div>
      </form>

      <div className="toolbar">
        <label className="check"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label>
      </div>
      <DataTable
        rowKey="SellerID"
        rows={sellers.data}
        loading={sellers.loading}
        columns={[
          { key: 'SellerID', label: 'ID' },
          { key: 'Name', label: 'Name' },
          { key: 'Phone', label: 'Phone' },
          { key: 'Email', label: 'Email' },
          { key: 'GSTIN', label: 'GSTIN' },
          { key: 'KYCStatus', label: 'KYC', render: (s) => <StatusBadge status={s.KYCStatus} /> },
          { key: 'JoinDate', label: 'Joined', render: (s) => formatDate(s.JoinDate) },
          { key: 'TotalPayable', label: 'Payable', align: 'right', render: (s) => formatINR(s.TotalPayable) },
          { key: 'TotalSettled', label: 'Settled', align: 'right', render: (s) => formatINR(s.TotalSettled) },
          { key: 'Active', label: 'Status', render: (s) => <StatusBadge status={s.Active ? 'Active' : 'Archived'} /> },
          {
            key: 'actions', label: 'Actions',
            render: (s) => s.Active && (
              <div className="actions">
                <button className="btn btn-small" onClick={() => edit(s)}>Edit</button>
                <button className="btn btn-small btn-danger-outline" onClick={() => archive(s)}>Archive</button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
