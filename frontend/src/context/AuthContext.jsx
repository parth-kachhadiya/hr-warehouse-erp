// Knows whether the user is logged in. status: 'loading' | 'in' | 'out'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);

  useEffect(() => {
    authApi.me()
      .then((u) => { setUser(u); setStatus('in'); })
      .catch(() => setStatus('out'));
  }, []);

  const login = useCallback(async (username, password) => {
    const u = await authApi.login(username, password);
    setUser(u);
    setStatus('in');
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } finally {
      setUser(null);
      setStatus('out');
    }
  }, []);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
