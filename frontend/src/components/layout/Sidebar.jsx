import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ open, onNavigate }) {
  const { logout } = useAuth();
  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand">
        <div className="brand-name">HR Warehouse</div>
        <div className="brand-sub">ERP 2.4</div>
      </div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={onNavigate}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button type="button" className="nav-link logout" onClick={logout}>Logout</button>
    </aside>
  );
}
