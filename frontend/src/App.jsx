import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ModalProvider } from './components/common/Modal';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddProduct from './pages/AddProduct';
import Stock from './pages/Stock';
import Sellers from './pages/Sellers';
import Buyers from './pages/Buyers';
import Billing from './pages/Billing';
import SalesOrders from './pages/SalesOrders';
import Payments from './pages/Payments';
import Settlements from './pages/Settlements';
import StorageBilling from './pages/StorageBilling';
import DeadStock from './pages/DeadStock';
import Finance from './pages/Finance';
import SystemManagement from './pages/SystemManagement';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModalProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="add-product" element={<AddProduct />} />
                <Route path="stock" element={<Stock />} />
                <Route path="sellers" element={<Sellers />} />
                <Route path="buyers" element={<Buyers />} />
                <Route path="billing" element={<Billing />} />
                <Route path="sales" element={<SalesOrders />} />
                <Route path="payments" element={<Payments />} />
                <Route path="settlements" element={<Settlements />} />
                <Route path="storage-billing" element={<StorageBilling />} />
                <Route path="dead-stock" element={<DeadStock />} />
                <Route path="finance" element={<Finance />} />
                <Route path="system" element={<SystemManagement />} />
                <Route path="settings" element={<Settings />} />
                <Route path="audit" element={<AuditLog />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
