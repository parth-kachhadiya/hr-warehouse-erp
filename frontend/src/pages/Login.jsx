import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Boxes, ReceiptText, TrendingUp, Warehouse } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useServerWake from '../hooks/useServerWake';
import ServerWake from '../components/auth/ServerWake';

export default function Login() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const server = useServerWake();
  const serverUp = server.state === 'up';

  useEffect(() => {
    if (serverUp) document.getElementById('u')?.focus();
  }, [serverUp]);

  if (status === 'in') return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <ServerWake {...server} />
    <div className="auth" inert={!serverUp}>
      <div className="auth-hero">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark"><Warehouse size={20} /></div>
          <div><div className="brand-name">HR Warehouse</div><div className="brand-sub">ERP 2.4</div></div>
        </div>
        <div>
          <h2>Run your warehouse from one place.</h2>
          <p>Stock, sales, payments, seller settlements and storage billing, all in sync.</p>
          <div className="auth-points">
            <div><Boxes size={18} /> Live stock and space tracking</div>
            <div><ReceiptText size={18} /> Billing with commission worked out for you</div>
            <div><TrendingUp size={18} /> Revenue, expenses and profit at a glance</div>
          </div>
        </div>
        <div className="brand-sub">© HR Warehouse</div>
      </div>
      <div className="auth-form-side">
        <form className="auth-card" onSubmit={submit}>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to your admin account</p>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label htmlFor="u">Username</label>
            <input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="p">Password</label>
            <input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <button className="btn btn-primary" disabled={busy || !serverUp}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
    </>
  );
}
