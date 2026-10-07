import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// During development, calls to /api are forwarded to the backend on port 5000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
