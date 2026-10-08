import { Landmark } from 'lucide-react';
import { getSellers, paySeller } from '../api/erp.api';
import useFetch from '../hooks/useFetch';
import { Alert, DataTable, PageHeader, Panel } from '../components/common/ui';
import { useModal } from '../components/common/Modal';
import { fmt } from '../utils/format';

export default function Settlements() {
  const { data, reload, error } = useFetch(getSellers);
  const modal = useModal();

  const pay = async (s) => {
    const amt = await modal.prompt(`Amount to settle (payable: ${fmt(s.TotalPayable)})`, { title: `Pay ${s.Name}`, type: 'number', defaultValue: s.TotalPayable, min: 0, confirmText: 'Pay' });
    if (!amt) return;
    paySeller({ sellerID: s.SellerID, amount: amt, mode: 'Bank Transfer' }).then(reload).catch((e) => modal.alert(e.message));
  };

  const rows = data || [];
  return (
    <>
      <PageHeader title="Seller Settlements" subtitle="Pay sellers what they are owed." />
      <Alert msg={error && { err: true, text: error }} />
      <Panel flush>
        <DataTable head={['Seller ID', 'Name', 'Payable ₹', 'Settled ₹', '']} rows={data ? rows.length : -1} empty="No sellers yet">
          {rows.map((s) => (
            <tr key={s.SellerID}>
              <td className="id-cell">{s.SellerID}</td>
              <td className="item-cell">{s.Name}</td>
              <td className="strong">{fmt(s.TotalPayable)}</td>
              <td>{fmt(s.TotalSettled)}</td>
              <td>{Number(s.TotalPayable) > 0 && <button className="btn btn-sm btn-soft-green" onClick={() => pay(s)}><Landmark size={14} />Pay</button>}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}
