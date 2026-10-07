import { useState } from 'react';
import { listStorageLedger, runStorageBilling, sellerSpaceSummary } from '../api/storage.api';
import { getSettings } from '../api/system.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import DataTable from '../components/common/DataTable';
import Message from '../components/common/Message';
import { useModal } from '../components/common/Modal';
import { currentMonthIST, formatDateTime, formatINR, formatNumber } from '../utils/format';

export default function StorageBilling() {
  const [month, setMonth] = useState('');
  const ledger = useFetch(() => listStorageLedger(month), [month]);
  const info = useFetch(async () => {
    const [settings, space] = await Promise.all([getSettings(), sellerSpaceSummary()]);
    return { settings, space };
  });
  const { message, setMessage, run } = useAction();
  const modal = useModal();
  const thisMonth = currentMonthIST();

  const runBilling = async () => {
    const ok = await modal.confirm(
      `Run storage billing for ${thisMonth}? Rent used so far this month (not already billed) will be deducted from each seller's payable.`,
      { confirmText: 'Run billing' }
    );
    if (!ok) return;
    const result = await run(runStorageBilling, (r) => (r.entries.length
      ? `Billed ${r.entries.length} product(s) for ${r.Month}. Total ${formatINR(r.totalCharge)} deducted from sellers.`
      : `Nothing new to bill for ${r.Month}.`));
    if (result) {
      ledger.reload({ silent: true });
      info.reload({ silent: true });
    }
  };

  const months = [...new Set([thisMonth, ...(ledger.data || []).map((r) => r.Month)])].sort().reverse();

  return (
    <div className="page">
      <div className="page-header">
        <h1>Storage Billing</h1>
        <button className="btn btn-primary" onClick={runBilling}>Run billing for {thisMonth}</button>
      </div>
      <Message message={message || (ledger.error && { type: 'error', text: ledger.error })} onClose={() => setMessage(null)} />
      {info.data && (
        <p className="muted">
          Rate: {formatINR(info.data.settings.StorageRatePerSqFtPerMonth)} per sq.ft per month, charged by the day for the space each seller's products occupy.
        </p>
      )}

      <section className="card">
        <h2>Space used by each seller (now)</h2>
        <DataTable
          rowKey="SellerID"
          rows={info.data?.space}
          loading={info.loading}
          empty="No seller products in the warehouse."
          columns={[
            { key: 'SellerID', label: 'ID' },
            { key: 'SellerName', label: 'Seller' },
            { key: 'Products', label: 'Products', align: 'right' },
            { key: 'Units', label: 'Units', align: 'right' },
            { key: 'SpaceSqFt', label: 'Space (sq.ft)', align: 'right', render: (r) => formatNumber(r.SpaceSqFt) },
            { key: 'est', label: 'Full-month rent', align: 'right', render: (r) => formatINR(r.SpaceSqFt * (info.data?.settings.StorageRatePerSqFtPerMonth || 0)) },
          ]}
        />
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Storage ledger</h2>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All months</option>
            {months.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <DataTable
          rowKey="EntryID"
          rows={ledger.data}
          loading={ledger.loading}
          empty="No storage charges yet."
          columns={[
            { key: 'EntryID', label: 'Entry' },
            { key: 'Month', label: 'Month' },
            { key: 'DateRun', label: 'Run on', render: (r) => formatDateTime(r.DateRun) },
            { key: 'SellerName', label: 'Seller', render: (r) => `${r.SellerID} · ${r.SellerName}` },
            { key: 'AssetID', label: 'Product' },
            { key: 'Quantity', label: 'Units', align: 'right' },
            { key: 'UnitSpaceSqFt', label: 'Sq.ft/unit', align: 'right', render: (r) => formatNumber(r.UnitSpaceSqFt) },
            { key: 'SpaceDaysCharged', label: 'Space-days', align: 'right', render: (r) => formatNumber(r.SpaceDaysCharged) },
            { key: 'DaysCharged', label: 'Days', align: 'right', render: (r) => formatNumber(r.DaysCharged) },
            { key: 'RatePerSqFt', label: 'Rate', align: 'right', render: (r) => formatINR(r.RatePerSqFt) },
            { key: 'Charge', label: 'Charge', align: 'right', render: (r) => <strong>{formatINR(r.Charge)}</strong> },
          ]}
        />
      </section>
    </div>
  );
}
