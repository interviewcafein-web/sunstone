import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Runs `start` once the intro animation in index.html has gone, so counting happens in view. */
function afterIntro(start: () => void): () => void {
  const root = document.documentElement;
  if (root.classList.contains('splash-gone')) {
    start();
    return () => {};
  }
  const observer = new MutationObserver(() => {
    if (!root.classList.contains('splash-gone')) return;
    observer.disconnect();
    start();
  });
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** A number that counts from its previous value to the new one. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = value;
      setDisplay(value);
      return;
    }

    let frame = 0;
    const stopWaiting = afterIntro(() => {
      const from = current.current;
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - (1 - progress) ** 3;
        current.current = Math.round(from + (value - from) * eased);
        setDisplay(current.current);
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });

    return () => {
      stopWaiting();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <>
      <span aria-hidden>{display.toLocaleString()}</span>
      <span className="sr-only">{value.toLocaleString()}</span>
    </>
  );
}
