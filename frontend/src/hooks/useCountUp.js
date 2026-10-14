import { useEffect, useRef, useState } from 'react';

// Makes a number roll up to its new value, e.g. "₹1,20,000" or "68%".
// Text without a number is returned as it is.
const NUMBER = /^(.*?)(-?[\d,]*\d(?:\.\d+)?)(.*)$/;

export default function useCountUp(value, duration = 700) {
  const text = String(value ?? '');
  const match = text.match(NUMBER);
  const target = match ? Number(match[2].replace(/,/g, '')) : null;
  const decimals = match && match[2].includes('.') ? match[2].split('.')[1].length : 0;
  const from = useRef(0);
  const [current, setCurrent] = useState(target);

  useEffect(() => {
    if (target === null) return undefined;
    const start = from.current;
    if (start === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target;
      setCurrent(target);
      return undefined;
    }
    let frame;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      setCurrent(start + (target - start) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); from.current = target; };
  }, [target, duration]);

  if (target === null) return text;
  const shown = (current ?? target).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${match[1]}${shown}${match[3]}`;
}
