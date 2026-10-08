// Small building blocks used by every page.
import { Children, cloneElement, isValidElement } from 'react';
import { AlertCircle, CheckCircle2, Inbox, Info } from 'lucide-react';

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

// Summary number with a coloured icon. tone: brand | green | amber | red | blue | violet | slate
export function Stat({ icon: Icon, label, value, tone = 'brand', compact = false }) {
  return (
    <div className={`stat ${compact ? 'compact' : ''}`}>
      {Icon && <div className={`stat-icon tone-${tone}`}><Icon size={compact ? 18 : 20} /></div>}
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
    </div>
  );
}

export function Panel({ title, description, actions, children, footer, flush = false }) {
  return (
    <section className="panel">
      {(title || actions) && (
        <div className="panel-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {flush ? children : <div className="panel-body">{children}</div>}
      {footer && <div className="panel-footer">{footer}</div>}
    </section>
  );
}

export function Field({ label, required, hint, children, span }) {
  return (
    <div className={`field ${span ? 'span-all' : ''}`}>
      {label && <label>{label}{required && <span className="req">*</span>}</label>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

// Green / red / blue message box. msg = { text, err } or { text, info }.
export function Alert({ msg }) {
  if (!msg || !msg.text) return null;
  const kind = msg.err ? 'error' : msg.info ? 'info' : 'success';
  const Icon = msg.err ? AlertCircle : msg.info ? Info : CheckCircle2;
  return (
    <div className={`alert alert-${kind}`} role={msg.err ? 'alert' : 'status'}>
      <Icon size={18} />
      <div>{msg.text}</div>
    </div>
  );
}

const TONES = {
  instock: 'blue', listed: 'violet', sold: 'green', damaged: 'red', archived: 'slate',
  paid: 'green', partial: 'amber', unpaid: 'red', void: 'slate',
  reserved: 'amber', readyforpickup: 'blue', partiallydelivered: 'violet', delivered: 'green', cancelled: 'red',
};
export function Badge({ children, tone }) {
  const key = String(children || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return <span className={`badge tone-${tone || TONES[key] || 'slate'}`}>{children}</span>;
}

// Data table. On phones each row becomes a card, using the column names as labels.
// rows: number of rows (pass -1 while loading) so the empty message shows only when there is nothing.
export function DataTable({ head, rows, empty = 'Nothing here yet', children, kv = false }) {
  const labelled = head
    ? Children.map(children, (tr) => (isValidElement(tr)
      ? cloneElement(tr, {}, Children.map(tr.props.children, (td, i) => (isValidElement(td) ? cloneElement(td, { 'data-label': head[i] ?? '' }) : td)))
      : tr))
    : children;
  return (
    <div className="table-wrap">
      <table className={`data ${head ? 'stack' : ''} ${kv ? 'kv' : ''}`}>
        {head && <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>}
        <tbody>
          {rows === 0
            ? <tr><td className="empty" colSpan={head ? head.length : 2}><Inbox size={28} />{empty}</td></tr>
            : labelled}
        </tbody>
      </table>
    </div>
  );
}
