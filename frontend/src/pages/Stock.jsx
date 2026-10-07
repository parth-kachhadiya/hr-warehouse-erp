import { useState } from 'react';
import { adjustQuantity, archiveAsset, changeStatus, listAssets, updateAsset } from '../api/assets.api';
import { getSettings, listCategories, listCustomFields } from '../api/system.api';
import useFetch from '../hooks/useFetch';
import useAction from '../hooks/useAction';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import Message from '../components/common/Message';
import Modal, { useModal } from '../components/common/Modal';
import MediaUploader from '../components/common/MediaUploader';
import { ASSET_STATUSES, CONDITION_GRADES, MANUAL_ASSET_STATUSES } from '../utils/constants';
import { formatDate, formatINR, formatNumber } from '../utils/format';

export default function Stock() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const assets = useFetch(() => listAssets({ search, status }), [search, status]);
  const lookups = useFetch(async () => {
    const [categories, fields, settings] = await Promise.all([listCategories(), listCustomFields(), getSettings()]);
    return { categories, fields, settings };
  });
  const { message, setMessage, run } = useAction();
  const modal = useModal();
  const [mediaAsset, setMediaAsset] = useState(null);

  const refresh = () => assets.reload({ silent: true });

  const edit = async (a) => {
    const fields = [
      { name: 'ItemName', label: 'Item name', defaultValue: a.ItemName },
      { name: 'Category', label: 'Category', type: 'select', required: false, defaultValue: a.Category,
        options: [{ value: '', label: '— None —' }, ...(lookups.data?.categories || []).map((c) => c.Name)] },
      { name: 'ConditionGrade', label: 'Condition grade', type: 'select', options: CONDITION_GRADES, defaultValue: a.ConditionGrade },
      { name: 'ReservePrice', label: 'Reserve price per unit (₹)', type: 'number', required: false, defaultValue: a.ReservePrice },
      { name: 'ListedPrice', label: 'Listed price per unit (₹)', type: 'number', required: false, defaultValue: a.ListedPrice },
      ...(lookups.data?.fields || []).map((f) => ({ name: `cf:${f.FieldName}`, label: f.FieldName, required: false, defaultValue: a.CustomFieldsData?.[f.FieldName] ?? '' })),
      { name: 'Notes', label: 'Notes', type: 'textarea', required: false, defaultValue: a.Notes },
    ];
    const values = await modal.form({ title: `Edit ${a.AssetID}`, fields, confirmText: 'Save' });
    if (!values) return;
    const CustomFieldsData = { ...(a.CustomFieldsData || {}) };
    const data = {};
    Object.entries(values).forEach(([k, v]) => {
      if (k.startsWith('cf:')) CustomFieldsData[k.slice(3)] = v;
      else data[k] = v;
    });
    if (await run(() => updateAsset(a.AssetID, { ...data, CustomFieldsData }), `${a.AssetID} updated`)) refresh();
  };

  const adjust = async (a) => {
    const min = a.QuantityReserved + a.QuantityDelivered + a.QuantityRemoved;
    const values = await modal.form({
      title: `Adjust quantity · ${a.AssetID}`,
      message: `Current total received: ${a.QuantityReceived}. It cannot go below ${min} (reserved + delivered + removed).`,
      fields: [
        { name: 'newQuantity', label: 'New total quantity', type: 'number', min, step: 1, defaultValue: a.QuantityReceived },
        { name: 'reason', label: 'Reason', type: 'textarea' },
      ],
      confirmText: 'Adjust',
    });
    if (!values) return;
    if (await run(() => adjustQuantity(a.AssetID, Number(values.newQuantity), values.reason), `${a.AssetID} quantity changed`)) refresh();
  };

  const archive = async (a) => {
    const reason = await modal.prompt(
      `Archive ${a.AssetID} (${a.ItemName})? ${a.QuantityAvailable} available unit(s) will be marked as removed. Enter a reason:`,
      { title: 'Archive product', confirmText: 'Archive', danger: true }
    );
    if (reason === null) return;
    if (await run(() => archiveAsset(a.AssetID, reason), `${a.AssetID} archived`)) refresh();
  };

  const setAssetStatus = async (a, value) => {
    if (await run(() => changeStatus(a.AssetID, value), `${a.AssetID} is now ${value}`)) refresh();
  };

  const locked = (a) => ['Sold', 'Archived'].includes(a.Status);

  const columns = [
    { key: 'AssetID', label: 'ID' },
    { key: 'ItemName', label: 'Item', render: (a) => (<><strong>{a.ItemName}</strong><div className="muted small">{a.Category}</div></>) },
    { key: 'SellerName', label: 'Seller', render: (a) => (a.SellerID ? `${a.SellerID} · ${a.SellerName}` : '—') },
    { key: 'ConditionGrade', label: 'Grade' },
    { key: 'QuantityReceived', label: 'Recv', align: 'right' },
    { key: 'QuantityAvailable', label: 'Avail', align: 'right' },
    { key: 'QuantityReserved', label: 'Res', align: 'right' },
    { key: 'QuantityDelivered', label: 'Deliv', align: 'right' },
    { key: 'QuantityRemoved', label: 'Rem', align: 'right' },
    { key: 'SpaceSqFt', label: 'Sq.ft/unit', align: 'right', render: (a) => formatNumber(a.SpaceSqFt) },
    { key: 'ListedPrice', label: 'Listed', align: 'right', render: (a) => formatINR(a.ListedPrice) },
    { key: 'DateReceived', label: 'Received', render: (a) => formatDate(a.DateReceived) },
    {
      key: 'Status', label: 'Status',
      render: (a) => (locked(a) ? <StatusBadge status={a.Status} /> : (
        <select value={a.Status} onChange={(e) => setAssetStatus(a, e.target.value)} className="inline-select">
          {MANUAL_ASSET_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      )),
    },
    {
      key: 'actions', label: 'Actions',
      render: (a) => (
        <div className="actions">
          {a.Status !== 'Sold' && <button className="btn btn-small" onClick={() => edit(a)}>Edit</button>}
          {!locked(a) && <button className="btn btn-small" onClick={() => adjust(a)}>Adjust Qty</button>}
          <button className="btn btn-small" onClick={() => setMediaAsset(a)}>Media{a.PhotoLinks?.length ? ` (${a.PhotoLinks.length})` : ''}</button>
          {a.Status !== 'Archived' && a.Status !== 'Sold' && <button className="btn btn-small btn-danger-outline" onClick={() => archive(a)}>Archive</button>}
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="page-header"><h1>Stock</h1></div>
      <Message message={message || (assets.error && { type: 'error', text: assets.error })} onClose={() => setMessage(null)} />
      <div className="toolbar">
        <input placeholder="Search ID, item, seller, category…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {ASSET_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <DataTable rowKey="AssetID" rows={assets.data} loading={assets.loading} columns={columns} empty="No products found." />

      <Modal open={Boolean(mediaAsset)} title={mediaAsset ? `Media · ${mediaAsset.AssetID} ${mediaAsset.ItemName}` : ''} onClose={() => setMediaAsset(null)} wide>
        {mediaAsset && (
          <MediaUploader
            asset={mediaAsset}
            maxPhotoMB={lookups.data?.settings.MaxPhotoMB}
            maxVideoMB={lookups.data?.settings.MaxVideoMB}
            onUpdated={(updated) => { setMediaAsset(updated); refresh(); }}
          />
        )}
      </Modal>
    </div>
  );
}
