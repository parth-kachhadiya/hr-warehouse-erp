import { NavLink } from 'react-router-dom';
import { LogOut, Warehouse, X } from 'lucide-react';
import { NAV_GROUPS } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const name = user?.username || 'admin';
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><Warehouse size={20} /></div>
        <div style={{ flex: 1 }}>
          <div className="brand-name">HR Warehouse</div>
          <div className="brand-sub">ERP 2.4</div>
        </div>
        {open && <button type="button" className="icon-button" onClick={onClose} aria-label="Close menu"><X size={18} /></button>}
      </div>
      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.title}>
            <div className="nav-group-title">{group.title}</div>
            {group.items.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} end={path === '/'} onClick={onClose}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-row">
          <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
          <div className="who"><strong>{name}</strong><span>Administrator</span></div>
          <button type="button" className="icon-button" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
        </div>
      </div>
    </aside>
  );
}
