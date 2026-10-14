import { useEffect } from 'react';

// Adds a soft "ripple" where a button or menu item is clicked. One listener for the whole app.
export default function useRipple() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const onDown = (e) => {
      const el = e.target.closest('.btn, .nav-item, .icon-button');
      if (!el || el.disabled) return;
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.left = `${e.clientX - rect.left - size / 2}px`;
      dot.style.top = `${e.clientY - rect.top - size / 2}px`;
      el.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
}
