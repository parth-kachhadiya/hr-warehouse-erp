import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { getSellerSpaceSummary, getStorageLedger, runMonthlyStorageBilling } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, DataTable, PageHeader, Panel } from '../components/common/ui';
import { fmt } from '../utils/format';

export default function StorageBilling() {
  const space = useFetch(getSellerSpaceSummary);
  const ledger = useFetch(getStorageLedger);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const results = await runMonthlyStorageBilling();
      if (results.length === 0) {
        setMsg({ info: true, text: 'No new charges — either no active stock, or this month is already billed.' });
      } else {
        const total = results.reduce((s, r) => s + r.charge, 0);
        setMsg({ text: `Billed ${results.length} seller(s), total ${fmt(total)}` });
      }
      space.reload();
      ledger.reload();
    } catch (e) {
      setMsg({ err: true, text: `Error: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const spaceRows = space.data || [];
  const ledgerRows = ledger.data || [];
  return (
    <>
      <PageHeader title="Monthly Storage Billing"
        subtitle="Charges every seller for the sq.ft their unsold stock occupies, at the storage rate in Settings. Run it once a month (e.g. on the 1st). Running it again the same month skips what is already billed, so it is safe to click if unsure.">
        <button className="btn btn-primary" onClick={run} disabled={busy}><CalendarClock size={16} />{busy ? 'Running...' : "Run This Month's Billing"}</button>
      </PageHeader>
      <Alert msg={msg || ((space.error || ledger.error) && { err: true, text: space.error || ledger.error })} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Panel title="Current Space Occupied" description="By seller" flush>
          <DataTable rows={space.data ? spaceRows.length : -1} empty="No active stock" head={['Seller', 'Physical Qty', 'Space Occupied']}>
            {spaceRows.map((r) => (
              <tr key={r.sellerID}><td className="item-cell">{r.sellerName}</td><td>{r.physicalQty || 0}</td><td className="strong">{Number(r.spaceOccupied || 0).toLocaleString('en-IN')} sq.ft</td></tr>
            ))}
          </DataTable>
        </Panel>
        <Panel title="Billing History" flush>
          <DataTable rows={ledger.data ? ledgerRows.length : -1} empty="No billing run yet" head={['Month', 'Seller', 'Space (sq.ft)', 'Rate', 'Charge']}>
            {ledgerRows.map((r) => (
              <tr key={r.EntryID}><td>{r.Month}</td><td className="item-cell">{r.SellerName}</td><td>{r.SpaceOccupiedSqFt}</td><td>₹{r.RatePerSqFt}</td><td className="strong">{fmt(r.Charge)}</td></tr>
            ))}
          </DataTable>
        </Panel>
      </div>
    </>
  );
}
