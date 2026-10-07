// A simple table. columns: [{ key, label, render?(row), align? }]
export default function DataTable({ columns, rows, rowKey, empty = 'Nothing to show yet.', loading = false }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows?.length ? (
            <tr><td colSpan={columns.length} className="empty">Loading…</td></tr>
          ) : !rows?.length ? (
            <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey ? row[rowKey] : i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'num' : ''}>
                    {c.render ? c.render(row) : row[c.key] ?? ''}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
