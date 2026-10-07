import { useEffect } from 'react';
import { getDashboard } from '../api/dashboard.api';
import useFetch from '../hooks/useFetch';
import StatCard from '../components/common/StatCard';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import Message from '../components/common/Message';
import { formatDateTime, formatINR, formatNumber } from '../utils/format';

export default function Dashboard() {
  const { data, error, reload } = useFetch(getDashboard);

  // Same as the old system: refresh every 3 seconds while the page is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') reload({ silent: true });
    }, 3000);
    return () => clearInterval(id);
  }, [reload]);

  const d = data;
  const b = d?.revenueBreakdown || {};
  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <span className="muted small">Auto-refreshes every 3 seconds</span>
      </div>
      <Message message={error ? { type: 'error', text: error } : null} />
      {!d ? <p className="muted">Loading…</p> : (
        <>
          <div className="stats">
            <StatCard label="GMV (total sales)" value={formatINR(d.gmv)} />
            <StatCard label="Total revenue" value={formatINR(d.totalRevenue)} tone="green" />
            <StatCard label="Items in stock" value={formatNumber(d.itemsInStock)} sub="units available" />
            <StatCard label="Utilization" value={`${formatNumber(d.utilization)}%`} sub={`${formatNumber(d.usedSpace)} / ${formatNumber(d.capacity)} sq.ft`} />
            <StatCard label="Receivable from buyers" value={formatINR(d.receivable)} tone="orange" />
            <StatCard label="Payable to sellers" value={formatINR(d.payableToSellers)} tone="blue" />
            <StatCard label="Dead stock alerts" value={d.deadStockAlerts} sub="30+ days in stock" tone={d.deadStockAlerts ? 'red' : undefined} />
          </div>

          <div className="grid-2">
            <section className="card">
              <h2>Revenue breakdown</h2>
              <table className="table compact">
                <tbody>
                  <tr><td>Commission</td><td className="num">{formatINR(b.commission)}</td></tr>
                  <tr><td>Storage</td><td className="num">{formatINR(b.storage)}</td></tr>
                  <tr><td>Marketing</td><td className="num">{formatINR(b.marketing)}</td></tr>
                  <tr><td>Repair</td><td className="num">{formatINR(b.repair)}</td></tr>
                  <tr><td>Logistics</td><td className="num">{formatINR(b.logistics)}</td></tr>
                  <tr className="total"><td>Total</td><td className="num">{formatINR(d.totalRevenue)}</td></tr>
                </tbody>
              </table>
            </section>
            <section className="card">
              <h2>Last 5 sales</h2>
              <DataTable
                rowKey="SaleID"
                rows={d.lastSales}
                empty="No sales yet."
                columns={[
                  { key: 'SaleID', label: 'Sale' },
                  { key: 'Date', label: 'Date', render: (r) => formatDateTime(r.Date) },
                  { key: 'ItemName', label: 'Item' },
                  { key: 'SalePrice', label: 'Total', align: 'right', render: (r) => formatINR(r.SalePrice) },
                  { key: 'OrderStatus', label: 'Status', render: (r) => <StatusBadge status={r.OrderStatus} /> },
                ]}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
