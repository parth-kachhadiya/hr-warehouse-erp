import { useEffect, useState } from 'react';
import { onBusyChange } from '../../api/client';

// Thin animated bar at the top of the screen while the app waits for the server.
// It only appears for requests that take longer than a moment, so quick ones don't flicker.
export default function TopProgress() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let timer;
    const unsubscribe = onBusyChange((on) => {
      clearTimeout(timer);
      if (on) timer = setTimeout(() => setBusy(true), 150);
      else setBusy(false);
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, []);
  return <div className={`top-progress ${busy ? 'on' : ''}`} aria-hidden="true" />;
}
