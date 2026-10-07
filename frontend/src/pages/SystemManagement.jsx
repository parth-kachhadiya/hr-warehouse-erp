import { useState } from 'react';
import { addCategory, addCustomField, listCategories, listCustomFields, removeCategory, removeCustomField, runHealthCheck } from '../api/system.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import DataTable from '../components/common/DataTable';
import Message from '../components/common/Message';
import { useModal } from '../components/common/Modal';
import { formatDateTime } from '../utils/format';

export default function SystemManagement() {
  const data = useFetch(async () => {
    const [categories, fields] = await Promise.all([listCategories(), listCustomFields()]);
    return { categories, fields };
  });
  const { message, setMessage, run } = useAction();
  const modal = useModal();
  const [category, setCategory] = useState('');
  const [field, setField] = useState('');
  const [health, setHealth] = useState(null);
  const refresh = () => data.reload({ silent: true });

  const addCat = async (e) => {
    e.preventDefault();
    if (await run(() => addCategory(category), `Category "${category}" added`)) { setCategory(''); refresh(); }
  };
  const removeCat = async (c) => {
    if (await modal.confirm(`Remove category "${c.Name}"?`, { confirmText: 'Remove', danger: true })
      && (await run(() => removeCategory(c.CategoryID), `Category "${c.Name}" removed`))) refresh();
  };
  const addField = async (e) => {
    e.preventDefault();
    if (await run(() => addCustomField(field), `Field "${field}" added to the Add Product form`)) { setField(''); refresh(); }
  };
  const removeField = async (f) => {
    if (await modal.confirm(`Remove field "${f.FieldName}" from the Add Product form? Saved values stay on existing products.`, { confirmText: 'Remove', danger: true })
      && (await run(() => removeCustomField(f.FieldID), `Field "${f.FieldName}" removed`))) refresh();
  };
  const check = async () => {
    const result = await run(runHealthCheck);
    if (result) setHealth(result);
  };

  return (
    <div className="page">
      <div className="page-header"><h1>System Management</h1></div>
      <Message message={message || (data.error && { type: 'error', text: data.error })} onClose={() => setMessage(null)} />

      <div className="grid-2">
        <section className="card">
          <h2>Categories</h2>
          <form className="inline-form" onSubmit={addCat}>
            <input placeholder="New category name" value={category} onChange={(e) => setCategory(e.target.value)} required />
            <button className="btn btn-primary">Add</button>
          </form>
          <DataTable
            rowKey="CategoryID"
            rows={data.data?.categories}
            loading={data.loading}
            columns={[
              { key: 'CategoryID', label: 'ID' },
              { key: 'Name', label: 'Name' },
              { key: 'actions', label: '', render: (c) => <button className="btn btn-small btn-danger-outline" onClick={() => removeCat(c)}>Remove</button> },
            ]}
          />
        </section>
        <section className="card">
          <h2>Custom fields (Add Product form)</h2>
          <form className="inline-form" onSubmit={addField}>
            <input placeholder="New field name, e.g. Brand" value={field} onChange={(e) => setField(e.target.value)} required />
            <button className="btn btn-primary">Add</button>
          </form>
          <DataTable
            rowKey="FieldID"
            rows={data.data?.fields}
            loading={data.loading}
            empty="No custom fields."
            columns={[
              { key: 'FieldID', label: 'ID' },
              { key: 'FieldName', label: 'Field' },
              { key: 'actions', label: '', render: (f) => <button className="btn btn-small btn-danger-outline" onClick={() => removeField(f)}>Remove</button> },
            ]}
          />
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Health check</h2>
          <button className="btn btn-secondary" onClick={check}>Run health check</button>
        </div>
        <p className="muted small">Checks that every product's quantities add up (Received = Available + Reserved + Delivered + Removed), and that no IDs are duplicated or missing.</p>
        {health && (
          health.ok ? (
            <div className="message message-success">All good. {health.assetsChecked} product(s) checked at {formatDateTime(health.checkedAt)}.</div>
          ) : (
            <DataTable
              rows={health.issues}
              columns={[
                { key: 'type', label: 'Problem' },
                { key: 'entity', label: 'Where' },
                { key: 'message', label: 'Details' },
              ]}
            />
          )
        )}
      </section>
    </div>
  );
}
