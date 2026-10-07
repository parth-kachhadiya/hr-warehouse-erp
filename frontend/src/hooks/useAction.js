// Runs a button action and shows a green success or red error banner.
import { useCallback, useState } from 'react';

export default function useAction() {
  const [message, setMessage] = useState(null);

  const run = useCallback(async (action, successText) => {
    try {
      const result = await action();
      if (successText) setMessage({ type: 'success', text: typeof successText === 'function' ? successText(result) : successText });
      return result;
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
      return undefined;
    }
  }, []);

  return { message, setMessage, run };
}
