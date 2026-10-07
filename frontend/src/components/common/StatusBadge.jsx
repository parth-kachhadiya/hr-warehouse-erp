const TONES = {
  'In Stock': 'green', Listed: 'blue', Damaged: 'orange', Sold: 'grey', Archived: 'grey',
  Paid: 'green', Partial: 'orange', Unpaid: 'red', Void: 'grey',
  Reserved: 'orange', 'Ready for Pickup': 'blue', 'Partially Delivered': 'purple', Delivered: 'green', Cancelled: 'grey',
  Active: 'green', Inactive: 'grey', Archived_: 'grey',
  Pending: 'orange', Verified: 'green', Rejected: 'red',
  Monitor: 'green', Reprice: 'blue', 'Bundle / discount': 'orange', 'Liquidation / auction': 'red', 'Seller exit / disposal': 'red',
};

export default function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`badge badge-${TONES[status] || 'grey'}`}>{status}</span>;
}
