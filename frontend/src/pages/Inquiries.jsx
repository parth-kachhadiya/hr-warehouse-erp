import { useEffect, useState } from 'react';
import { MessageSquarePlus, Trash2 } from 'lucide-react';
import { addInquiry, deleteInquiry, getBuyers, getCategories, getInquiries, getSellers } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, DataTable, Field, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';
import { formatDate } from '../utils/format';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // yyyy-mm-dd

// One page for both inquiry forms. type: 'Buyer' | 'Seller'
export default function Inquiries({ type }) {
  const who = type.toLowerCase();
  const EMPTY = { existing: false, personID: '', name: '', area: '', category: '', mobile: '', date: today() };
  const list = useFetch(() => getInquiries(type), [type]);
  const people = useFetch(type === 'Buyer' ? getBuyers : getSellers, [type]);
  const [categories, setCategories] = useState([]);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const modal = useModal();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const idField = type === 'Buyer' ? 'BuyerID' : 'SellerID';

  useEffect(() => {
    getCategories().then((rows) => setCategories(rows.map((c) => c.Name))).catch(() => setCategories([]));
  }, []);

  // Picking an existing person fills in their mobile number (it can still be changed).
  const pickPerson = (e) => {
    const p = (people.data || []).find((x) => x[idField] === e.target.value);
    setF({ ...f, personID: e.target.value, mobile: p?.Phone || f.mobile });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (f.existing ? !f.personID : !f.name.trim()) return setMsg({ err: true, text: f.existing ? `Choose the ${who}` : 'Name required' });
    if (!f.area.trim() || !f.category) return setMsg({ err: true, text: 'Area and product category are required' });
    setBusy(true);
    try {
      const id = await addInquiry({ ...f, type, personID: f.existing ? f.personID : '', name: f.existing ? '' : f.name });
      setMsg({ text: `Inquiry ${id} saved.` });
      setF({ ...EMPTY, existing: f.existing, date: f.date });
      list.reload();
    } catch (err) {
      setMsg({ err: true, text: `Error: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (q) => {
    if (!(await modal.confirm(`Delete inquiry ${q.InquiryID} from ${q.Name}?`, { title: 'Delete inquiry', confirmText: 'Delete', danger: true }))) return;
    deleteInquiry(q.InquiryID).then(list.reload).catch((err) => modal.alert(`Error: ${err.message}`));
  };

  const rows = list.data || [];
  return (
    <>
      <PageHeader title={`${type} Inquiries`} subtitle={`What ${who}s ask us about. Saved for follow-up only; nothing is sold or added to stock.`} />
      <Alert msg={msg || (list.error && { err: true, text: list.error })} />
      <form noValidate onSubmit={submit}>
        <Panel title={`New ${who} inquiry`}
          footer={<button className="btn btn-primary" disabled={busy}><MessageSquarePlus size={16} />{busy ? 'Saving...' : 'Save Inquiry'}</button>}>
          <div className="form-grid">
            <Field span>
              <label className="check">
                <input type="checkbox" checked={f.existing} onChange={(e) => setF({ ...f, existing: e.target.checked, personID: '', name: '' })} />
                <span>Already in our {type === 'Buyer' ? 'Buyers' : 'Sellers'} list</span>
              </label>
            </Field>
            {f.existing ? (
              <Field label={type} required>
                <select value={f.personID} onChange={pickPerson}>
                  <option value="">-- select {who} --</option>
                  {(people.data || []).map((p) => <option key={p[idField]} value={p[idField]}>{p.Name}{p.Phone ? ` — ${p.Phone}` : ''}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Name" required><input value={f.name} onChange={set('name')} placeholder="e.g. Ramesh Patel" /></Field>
            )}
            <Field label="Area" required><input value={f.area} onChange={set('area')} placeholder="e.g. Varachha" /></Field>
            <Field label="Product category" required>
              <select value={f.category} onChange={set('category')}>
                <option value="">-- select category --</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Mobile (optional)"><input value={f.mobile} onChange={set('mobile')} inputMode="tel" placeholder="e.g. 98250 12345" /></Field>
            <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
          </div>
        </Panel>
      </form>

      <Panel title={`${type} inquiries`} flush>
        <DataTable rows={list.data ? rows.length : -1} empty="No inquiries yet"
          head={['ID', 'Date', 'Name', 'Area', 'Category', 'Mobile', '']}>
          {rows.map((q) => (
            <tr key={q.InquiryID}>
              <td className="id-cell">{q.InquiryID}</td>
              <td>{formatDate(q.Date)}</td>
              <td className="item-cell">{q.Name}{q.PersonID && <span className="tag">{q.PersonID}</span>}</td>
              <td>{q.Area}</td>
              <td>{q.Category}</td>
              <td>{q.Mobile || '-'}</td>
              <td><button type="button" className="btn btn-sm btn-soft-red" onClick={() => remove(q)}><Trash2 size={14} />Delete</button></td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
