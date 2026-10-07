// One axios instance for the whole app.
// - Sends the login cookie with every request (withCredentials).
// - Unwraps { success, data } so callers get the data directly.
// - Any 401 (not logged in / session expired) sends the user to the Login page.
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

client.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
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
