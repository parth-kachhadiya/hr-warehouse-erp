// One axios instance for the whole app.
// - Sends the login cookie with every request (withCredentials).
// - Unwraps { success, data } so callers get the data directly.
// - Any 401 (not logged in / session expired) sends the user to the Login page.
// - Counts requests in flight so the top loading bar can show (pass { silent: true } to skip).
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

let inFlight = 0;
const listeners = new Set();
const setInFlight = (delta) => {
  inFlight = Math.max(0, inFlight + delta);
  listeners.forEach((fn) => fn(inFlight > 0));
};
// Calls fn(true/false) whenever the app starts or stops waiting for the server.
export const onBusyChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const done = (config) => { if (config && !config.silent) setInFlight(-1); };

client.interceptors.request.use((config) => {
  if (!config.silent) setInFlight(1);
  return config;
});

client.interceptors.response.use(
  (response) => {
    done(response.config);
    return response.data.data;
  },
  (error) => {
    done(error.config);
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/me');
    if (status === 401 && !isAuthCall && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    const err = new Error(error.response?.data?.message || error.message || 'Request failed');
    err.status = status;
    err.code = error.response?.data?.code;
    return Promise.reject(err);
  }
);

export default client;
