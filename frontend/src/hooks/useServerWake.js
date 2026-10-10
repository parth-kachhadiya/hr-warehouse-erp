// Wakes the backend before anyone uses the Login page.
// Render's free server sleeps after 15 minutes with no visits and takes a while to start again.
// This keeps calling /api/ping until the server answers, then reports 'up'.
// state: 'checking' | 'up'. seconds: how long we have waited so far.
import { useEffect, useState } from 'react';

const PING_URL = `${import.meta.env.VITE_API_URL || '/api'}/ping`;
const REQUEST_TIMEOUT_MS = 20000; // give one sleeping-server request time to finish
const RETRY_DELAY_MS = 2000;

export default function useServerWake() {
  const [state, setState] = useState('checking');
  const [seconds, setSeconds] = useState(0);
  const [response, setResponse] = useState(null);

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);

    const ping = async () => {
      while (!stopped) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const res = await fetch(PING_URL, { cache: 'no-store', signal: controller.signal });
          const body = await res.json();
          if (res.ok && body?.success && body?.data === 'ok') {
            if (!stopped) { setResponse(body); setState('up'); }
            return;
          }
        } catch {
          // Server still asleep (timeout, 502/503/504 or not JSON yet). Try again.
        } finally {
          clearTimeout(timeout);
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    };

    ping().finally(() => clearInterval(timer));
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  return { state, seconds, response };
}
