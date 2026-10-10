// What the Login page shows while the backend wakes up:
// - a full-screen loader that blocks the page until the server answers
// - then a green popup with the server's reply, which hides itself after a few seconds
import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export default function ServerWake({ state, seconds, response }) {
  const [showDone, setShowDone] = useState(true);

  useEffect(() => {
    if (state !== 'up') return undefined;
    const t = setTimeout(() => setShowDone(false), 6000);
    return () => clearTimeout(t);
  }, [state]);

  if (state === 'checking') {
    return (
      <div className="wake-backdrop" role="alertdialog" aria-live="polite" aria-label="Server is starting">
        <div className="wake-card">
          <div className="spinner" />
          <h3>Server is starting…</h3>
          <p>The server goes to sleep when nobody uses it. Waking it up now, this usually takes about 15 to 60 seconds.</p>
          <div className="wake-timer">{seconds}s</div>
          {seconds >= 60 && <p className="wake-slow">Taking longer than usual. Still trying, please keep this page open.</p>}
        </div>
      </div>
    );
  }

  if (!showDone) return null;
  return (
    <div className="wake-toast" role="status">
      <CheckCircle2 size={20} />
      <div>
        <strong>Server is ready</strong>
        <div>You can sign in now.</div>
        {response && <code>{JSON.stringify(response)}</code>}
      </div>
      <button type="button" className="wake-close" onClick={() => setShowDone(false)} aria-label="Close"><X size={16} /></button>
    </div>
  );
}
