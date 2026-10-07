// Only lets logged-in users see the pages inside it; others go to Login.
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="center-screen">Loading…</div>;
  if (status !== 'in') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
