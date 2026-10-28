import { useEffect, useRef, useState } from 'react';

import { afterIntro, prefersReducedMotion } from '@/components/common/CountUp';
import { cn } from '@/lib/utils';

/**
 * Counts from 0 up to `target` the first time the element scrolls into view (after the
 * intro animation), easing out. Later changes animate from the current value.
 */
export function useReveal<T extends Element>(target: number, duration = 1100) {
  const ref = useRef<T>(null);
  const [value, setValue] = useState(0);
  const [seen, setSeen] = useState(false);
  const current = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    if (prefersReducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }
    let frame = 0;
    const stopWaiting = afterIntro(() => {
      const from = current.current;
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - (1 - progress) ** 3;
        current.current = from + (target - from) * eased;
        setValue(current.current);
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    return () => {
      stopWaiting();
      cancelAnimationFrame(frame);
    };
  }, [seen, target, duration]);

  return { ref, value };
}

/**
 * A percentage ring that draws itself and counts up its number when it comes into view.
 * `color` is the arc colour; `track` the empty part (an SVG stroke colour or a class).
 */
export function AnimatedRing({
  value,
  size = 56,
  stroke = 6,
  color,
  trackClassName = 'stroke-slate-200',
  trackColor,
  textClassName = 'fill-slate-800 text-[13px] font-bold',
  textColor,
  suffix = '%',
  className,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  /** A fixed arc colour, or one that follows the number as it climbs. */
  color: string | ((value: number) => string);
  trackClassName?: string;
  trackColor?: string;
  textClassName?: string;
  textColor?: string;
  suffix?: string;
  className?: string;
}) {
  const { ref, value: shown } = useReveal<SVGSVGElement>(value ?? 0);
  const radius = size / 2 - stroke / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className={trackColor ? undefined : trackClassName}
        stroke={trackColor}
      />
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        stroke={typeof color === 'function' ? color(shown) : color}
        strokeDasharray={`${(Math.min(100, Math.max(0, shown)) / 100) * circumference} ${circumference}`}
        transform={`rotate(-90 ${centre} ${centre})`}
        style={{ opacity: shown > 0.5 ? 1 : 0 }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className={textColor ? undefined : textClassName}
        fill={textColor}
        style={textColor ? { fontSize: size / 4.6, fontWeight: 700 } : undefined}
      >
        {value === null ? '—' : `${Math.round(shown)}${suffix}`}
      </text>
    </svg>
  );
}
