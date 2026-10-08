import { useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { addCategory, addCustomField, deleteCategory, deleteCustomField, getCategories, getCustomFields, syncSystem } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, DataTable, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';

export default function SystemManagement() {
  const cats = useFetch(getCategories);
  const fields = useFetch(() => getCustomFields('Assets'));
  const [newCat, setNewCat] = useState('');
  const [newField, setNewField] = useState('');
  const [catMsg, setCatMsg] = useState(null);
  const [fieldMsg, setFieldMsg] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const modal = useModal();
  const reload = () => { cats.reload(); fields.reload(); };
  const onErr = (e) => modal.alert(`Error: ${e.message}`);

  const addCat = (e) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    addCategory(newCat).then(() => { setNewCat(''); setCatMsg({ text: 'Category added' }); reload(); })
      .catch((err) => setCatMsg({ err: true, text: `Error: ${err.message}` }));
  };
  const removeCat = async (id) => {
    if (!(await modal.confirm('Remove this category?', { title: 'Remove category', confirmText: 'Remove', danger: true }))) return;
    deleteCategory(id).then(reload).catch(onErr);
  };
  const addField = (e) => {
    e.preventDefault();
    if (!newField.trim()) return;
    addCustomField('Assets', newField).then(() => { setNewField(''); setFieldMsg({ text: 'Field added' }); reload(); })
      .catch((err) => setFieldMsg({ err: true, text: `Error: ${err.message}` }));
  };
  const removeField = async (id) => {
    if (!(await modal.confirm('Remove this field?', { title: 'Remove field', confirmText: 'Remove', danger: true }))) return;
    deleteCustomField(id).then(reload).catch(onErr);
  };
  const sync = () => {
    setSyncing(true);
    syncSystem().then(() => {
      setSyncMsg({ text: 'Synced — all tabs now reflect the latest categories/fields/settings.' });
      reload();
      setTimeout(() => setSyncMsg(null), 4000);
    }).catch(onErr).finally(() => setSyncing(false));
  };

  const catRows = cats.data || [];
  const fieldRows = fields.data || [];
  return (
    <>
      <PageHeader title="System Management" subtitle="Add or remove categories and extra product fields. Changes apply everywhere straight away.">
        <button className="btn btn-secondary" onClick={sync} disabled={syncing}><RefreshCw size={16} />{syncing ? 'Syncing...' : 'Sync System'}</button>
      </PageHeader>
      <Alert msg={syncMsg} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div>
          <Alert msg={catMsg} />
          <Panel title="Categories" description="Used in Add Product" flush>
            <form noValidate onSubmit={addCat} className="panel-body" style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
              <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Electronics" aria-label="New Category" />
              <button className="btn btn-primary"><Plus size={16} />Add Category</button>
            </form>
            <DataTable rows={cats.data ? catRows.length : -1} empty="No categories yet">
              {catRows.map((c) => (
                <tr key={c.CategoryID}><td className="item-cell">{c.Name}</td><td style={{ textAlign: 'right' }}><button className="btn btn-sm btn-soft-red" onClick={() => removeCat(c.CategoryID)}><Trash2 size={14} />Remove</button></td></tr>
              ))}
            </DataTable>
          </Panel>
        </div>
        <div>
          <Alert msg={fieldMsg} />
          <Panel title="Custom Fields" description="Extra fields on the Add Product form" flush>
            <form noValidate onSubmit={addField} className="panel-body" style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
              <input className="input" value={newField} onChange={(e) => setNewField(e.target.value)} placeholder="e.g. Brand, Warranty Period" aria-label="New Field Name" />
              <button className="btn btn-primary"><Plus size={16} />Add Field</button>
            </form>
            <DataTable rows={fields.data ? fieldRows.length : -1} empty="No custom fields yet">
              {fieldRows.map((f) => (
                <tr key={f.FieldID}><td className="item-cell">{f.FieldName}</td><td style={{ textAlign: 'right' }}><button className="btn btn-sm btn-soft-red" onClick={() => removeField(f.FieldID)}><Trash2 size={14} />Remove</button></td></tr>
              ))}
            </DataTable>
          </Panel>
        </div>
      </div>
    </>
  );
}
