import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Boxes, Gauge, HandCoins, IndianRupee, Megaphone, Percent, Truck, Warehouse, Wallet, Wrench, TrendingUp,
} from 'lucide-react';
import { getDashboardData } from '../api/erp.api';
import { Alert, Badge, DataTable, PageHeader, Panel, Stat } from '../components/common/ui';
import { fmt } from '../utils/format';

// Refreshes every 3 seconds while the page is open and the browser tab is visible.
export default function Dashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const inflight = useRef(false);

  const load = useCallback(async (force) => {
    if (inflight.current && !force) return;
    inflight.current = true;
    try {
      setD(await getDashboardData());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => load(true), 0);
    const timer = setInterval(() => { if (!document.hidden) load(false); }, 3000);
    const onVisible = () => { if (!document.hidden) load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(first); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live overview of stock, sales and money. Updates every few seconds." />
      <Alert msg={error && { err: true, text: error }} />
      {d && (
        <>
          <div className="stats">
            <Stat icon={IndianRupee} label="Total GMV" value={fmt(d.totalGMV)} tone="brand" />
            <Stat icon={TrendingUp} label="Total Revenue" value={fmt(d.totalRevenue)} tone="green" />
            <Stat icon={Boxes} label="Items in Stock" value={d.itemsInStock} tone="blue" />
            <Stat icon={Gauge} label="Warehouse Utilization" value={`${d.warehouse.utilizationPct}%`} tone="violet" />
            <Stat icon={HandCoins} label="Receivable (from buyers)" value={fmt(d.totalReceivable)} tone={d.totalReceivable > 0 ? 'amber' : 'slate'} />
            <Stat icon={Wallet} label="Payable (to sellers)" value={fmt(d.totalPayableToSellers)} tone={d.totalPayableToSellers > 0 ? 'amber' : 'slate'} />
            <Stat icon={AlertTriangle} label="Dead Stock Alerts (30+ days)" value={d.deadStockAlerts} tone={d.deadStockAlerts > 0 ? 'red' : 'green'} />
          </div>

          <h2 className="section-title">Revenue breakdown</h2>
          <div className="stats compact">
            <Stat compact icon={Percent} label="Commission" value={fmt(d.revenueBreakdown.commission)} tone="green" />
            <Stat compact icon={Warehouse} label="Storage" value={fmt(d.revenueBreakdown.storage)} tone="green" />
            <Stat compact icon={Megaphone} label="Marketing" value={fmt(d.revenueBreakdown.marketing)} tone="green" />
            <Stat compact icon={Wrench} label="Repair" value={fmt(d.revenueBreakdown.repair)} tone="green" />
            <Stat compact icon={Truck} label="Logistics" value={fmt(d.revenueBreakdown.logistics)} tone="green" />
          </div>

          <div style={{ height: 12 }} />
          <Panel title="Recent Sales" description="Last 5 sales" flush>
            <DataTable head={['Sale ID', 'Item', 'Buyer', 'Price', 'Status']} rows={d.recentSales.length} empty="No sales yet">
              {d.recentSales.map((s) => (
                <tr key={s.SaleID}>
                  <td className="id-cell">{s.SaleID}</td>
                  <td className="item-cell">{s.ItemName} × {s.Quantity || 1}</td>
                  <td>{s.BuyerName || '-'}</td>
                  <td className="strong">{fmt(s.SalePrice)}</td>
                  <td><Badge>{s.PaymentStatus}</Badge></td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </>
      )}
    </>
  );
}
