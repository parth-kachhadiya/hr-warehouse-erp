import { useState } from 'react';
import { addExpense, getFinanceSummary, listExpenses, voidExpense } from '../api/finance.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import DataTable from '../components/common/DataTable';
import FormField from '../components/common/FormField';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import Message from '../components/common/Message';
import { useModal } from '../components/common/Modal';
import { EXPENSE_CATEGORIES } from '../utils/constants';
import { formatDate, formatINR, todayIST } from '../utils/format';

export default function Finance() {
  const data = useFetch(async () => {
    const [summary, expenses] = await Promise.all([getFinanceSummary(), listExpenses()]);
    return { summary, expenses };
  });
  const { message, setMessage, run } = useAction();
  const modal = useModal();
  const empty = { Date: todayIST(), Category: 'Rent', Amount: '', Notes: '' };
  const [form, setForm] = useState(empty);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const refresh = () => data.reload({ silent: true });

  const submit = async (e) => {
    e.preventDefault();
    if (await run(() => addExpense(form), (x) => `Expense ${x.ExpenseID} added`)) {
      setForm(empty);
      refresh();
    }
  };

  const voidIt = async (x) => {
    const reason = await modal.prompt(`Void expense ${x.ExpenseID} (${formatINR(x.Amount)})? Enter a reason:`, { title: 'Void expense', confirmText: 'Void', danger: true });
    if (reason !== null && (await run(() => voidExpense(x.ExpenseID, reason), `${x.ExpenseID} voided`))) refresh();
  };

  const s = data.data?.summary;
  const b = s?.revenueBreakdown || {};
  return (
    <div className="page">
      <div className="page-header"><h1>Finance</h1></div>
      <Message message={message || (data.error && { type: 'error', text: data.error })} onClose={() => setMessage(null)} />
      {s && (
        <div className="stats">
          <StatCard label="Total revenue" value={formatINR(s.totalRevenue)} tone="green" />
          <StatCard label="Total expenses" value={formatINR(s.totalExpenses)} tone="orange" />
          <StatCard label="Net profit" value={formatINR(s.netProfit)} tone={s.netProfit < 0 ? 'red' : 'blue'} />
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <h2>Revenue</h2>
          <table className="table compact">
            <tbody>
              <tr><td>Commission</td><td className="num">{formatINR(b.commission)}</td></tr>
              <tr><td>Storage</td><td className="num">{formatINR(b.storage)}</td></tr>
              <tr><td>Marketing</td><td className="num">{formatINR(b.marketing)}</td></tr>
              <tr><td>Repair</td><td className="num">{formatINR(b.repair)}</td></tr>
              <tr><td>Logistics</td><td className="num">{formatINR(b.logistics)}</td></tr>
              <tr className="total"><td>Total</td><td className="num">{formatINR(s?.totalRevenue)}</td></tr>
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2>Expenses by category</h2>
          <table className="table compact">
            <tbody>
              {(s?.expensesByCategory || []).map((c) => <tr key={c.Category}><td>{c.Category}</td><td className="num">{formatINR(c.Total)}</td></tr>)}
              <tr className="total"><td>Total</td><td className="num">{formatINR(s?.totalExpenses)}</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      <form className="card form-grid" onSubmit={submit}>
        <FormField label="Date" required><input type="date" value={form.Date} onChange={set('Date')} required /></FormField>
        <FormField label="Category">
          <select value={form.Category} onChange={set('Category')}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </FormField>
        <FormField label="Amount (₹)" required><input type="number" min="0" step="any" value={form.Amount} onChange={set('Amount')} required /></FormField>
        <FormField label="Notes"><input value={form.Notes} onChange={set('Notes')} /></FormField>
        <div className="form-actions"><button className="btn btn-primary">Add expense</button></div>
      </form>

      <DataTable
        rowKey="ExpenseID"
        rows={data.data?.expenses}
        loading={data.loading}
        empty="No expenses yet."
        columns={[
          { key: 'ExpenseID', label: 'ID' },
          { key: 'Date', label: 'Date', render: (x) => formatDate(x.Date) },
          { key: 'Category', label: 'Category' },
          { key: 'Amount', label: 'Amount', align: 'right', render: (x) => formatINR(x.Amount) },
          { key: 'Notes', label: 'Notes', render: (x) => (<>{x.Notes}{x.VoidReason && <div className="muted small">Void: {x.VoidReason}</div>}</>) },
          { key: 'Status', label: 'Status', render: (x) => <StatusBadge status={x.Status} /> },
          { key: 'actions', label: '', render: (x) => x.Status === 'Active' && <button className="btn btn-small btn-danger-outline" onClick={() => voidIt(x)}>Void</button> },
        ]}
      />
    </div>
  );
}
