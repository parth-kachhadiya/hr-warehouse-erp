import { useState } from 'react';
import { Plus, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { addExpense, deleteExpense, getExpenses, getFinanceSummary } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, DataTable, Field, PageHeader, Panel, Stat } from '../components/common/ui';
import { useModal } from '../components/common/Modal';
import { fmt, formatDateTime } from '../utils/format';
import { EXPENSE_CATEGORIES } from '../utils/constants';

export default function Finance() {
  const summary = useFetch(getFinanceSummary);
  const expenses = useFetch(getExpenses);
  const [e, setE] = useState({ category: 'Rent', amount: '', notes: '' });
  const modal = useModal();
  const reload = () => { summary.reload(); expenses.reload(); };
  const onErr = (err) => modal.alert(`Error: ${err.message}`);

  const submit = (ev) => {
    ev.preventDefault();
    if (!e.amount) return;
    addExpense(e).then(() => { setE({ ...e, amount: '', notes: '' }); reload(); }).catch(onErr);
  };
  const remove = async (id) => {
    if (!(await modal.confirm('Void this expense? The audit trail will remain.', { title: 'Delete expense', confirmText: 'Delete', danger: true }))) return;
    deleteExpense(id).then(reload).catch(onErr);
  };

  const f = summary.data;
  const rows = expenses.data || [];
  const revenueRows = f ? Object.entries(f.revenue).filter(([k]) => k !== 'total') : [];
  const expenseRows = f ? Object.entries(f.expensesByCategory) : [];
  return (
    <>
      <PageHeader title="Finance" subtitle="Revenue, expenses and profit for the whole system." />
      <Alert msg={(summary.error || expenses.error) && { err: true, text: summary.error || expenses.error }} />
      {f && (
        <>
          <div className="stats">
            <Stat icon={TrendingUp} label="Total Revenue" value={fmt(f.revenue.total)} tone="green" />
            <Stat icon={TrendingDown} label="Total Expenses" value={fmt(f.totalExpenses)} tone="red" />
            <Stat icon={Wallet} label="Net Profit" value={fmt(f.netProfit)} tone={f.netProfit >= 0 ? 'brand' : 'red'} />
          </div>
          <div className="grid-2" style={{ alignItems: 'start', marginTop: 8 }}>
            <Panel title="Revenue Breakdown" flush>
              <DataTable kv rows={revenueRows.length}>
                {revenueRows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{fmt(v)}</td></tr>)}
              </DataTable>
            </Panel>
            <Panel title="Expenses by Category" flush>
              <DataTable kv rows={expenseRows.length} empty="No expenses yet">
                {expenseRows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{fmt(v)}</td></tr>)}
              </DataTable>
            </Panel>
          </div>
        </>
      )}
      <form noValidate onSubmit={submit}>
        <Panel title="Log an Expense" footer={<button className="btn btn-primary"><Plus size={16} />Add Expense</button>}>
          <div className="form-grid">
            <Field label="Category">
              <select value={e.category} onChange={(ev) => setE({ ...e, category: ev.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Amount (₹)" required><input type="number" inputMode="decimal" value={e.amount} onChange={(ev) => setE({ ...e, amount: ev.target.value })} /></Field>
            <Field label="Notes"><input value={e.notes} onChange={(ev) => setE({ ...e, notes: ev.target.value })} /></Field>
          </div>
        </Panel>
      </form>
      <Panel title="Expenses" flush>
        <DataTable rows={expenses.data ? rows.length : -1} empty="No expenses logged" head={['Date', 'Category', 'Amount', 'Notes', '']}>
          {rows.map((x) => (
            <tr key={x.ExpenseID}>
              <td className="muted">{formatDateTime(x.Date)}</td><td className="item-cell">{x.Category}</td><td className="strong">{fmt(x.Amount)}</td>
              <td className="wrap">{x.Notes || '-'}</td>
              <td><button className="btn btn-sm btn-soft-red" onClick={() => remove(x.ExpenseID)}><Trash2 size={14} />Delete</button></td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
