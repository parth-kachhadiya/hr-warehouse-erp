import {
  Boxes, CalendarClock, ClipboardList, Hourglass, Landmark, LayoutDashboard, PackagePlus,
  ReceiptText, ScrollText, Settings, SlidersHorizontal, Store, TrendingUp, UserRound, Wallet,
} from 'lucide-react';

// Same 15 screens as the old system, grouped so the menu is easier to scan.
export const NAV_GROUPS = [
  { title: 'Overview', items: [{ path: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Inventory',
    items: [
      { path: '/add-product', label: 'Add Product', icon: PackagePlus },
      { path: '/stock', label: 'Stock', icon: Boxes },
      { path: '/dead-stock', label: 'Dead Stock', icon: Hourglass },
    ],
  },
  {
    title: 'Sales',
    items: [
      { path: '/billing', label: 'Sell / Billing', icon: ReceiptText },
      { path: '/sales', label: 'Sales / Orders', icon: ClipboardList },
      { path: '/payments', label: 'Payments', icon: Wallet },
    ],
  },
  {
    title: 'People',
    items: [
      { path: '/sellers', label: 'Sellers', icon: Store },
      { path: '/buyers', label: 'Buyers', icon: UserRound },
      { path: '/settlements', label: 'Settlements', icon: Landmark },
    ],
  },
  {
    title: 'Finance',
    items: [
      { path: '/storage-billing', label: 'Storage Billing', icon: CalendarClock },
      { path: '/finance', label: 'Finance', icon: TrendingUp },
    ],
  },
  {
    title: 'System',
    items: [
      { path: '/system', label: 'System Management', icon: SlidersHorizontal },
      { path: '/settings', label: 'Settings', icon: Settings },
      { path: '/audit', label: 'Audit Log', icon: ScrollText },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export const CONDITION_GRADES = ['A', 'B', 'C', 'D', 'E'];
export const STOCK_STATUS_OPTIONS = ['In Stock', 'Listed', 'Damaged'];
export const EXPENSE_CATEGORIES = ['Rent', 'Staff', 'Utilities', 'Marketing', 'Insurance', 'Other'];
