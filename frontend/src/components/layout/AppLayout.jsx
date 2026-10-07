import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="layout">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">☰</button>
        <span>HR Warehouse ERP</span>
      </header>
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
