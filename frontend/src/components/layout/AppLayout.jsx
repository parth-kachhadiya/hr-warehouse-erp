import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Warehouse } from 'lucide-react';
import Sidebar from './Sidebar';
import { NAV_ITEMS } from '../../utils/constants';

// Sidebar + page. On tablets and phones the sidebar slides in from the menu button.
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const current = NAV_ITEMS.find((i) => i.path === pathname) || NAV_ITEMS[0];
  return (
    <div className="app-shell">
      <div className={`scrim ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="brand-mark"><Warehouse size={16} /></div>
          <div className="topbar-title">{current.label}</div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
