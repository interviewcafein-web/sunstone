import { useId } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/** The change from the previous point to the latest, ignoring gaps (null). */
export function lastChange(values: (number | null | undefined)[]): number | null {
  const points = values.filter((value): value is number => typeof value === 'number');
  return points.length > 1 ? points[points.length - 1] - points[points.length - 2] : null;
}

const toneFor = (change: number | null) =>
  change === null || change === 0 ? '#94a3b8' : change > 0 ? '#10b981' : '#ef4444';

interface SparklineProps {
  values: (number | null | undefined)[];
  width?: number;
  height?: number;
  /** Fixed 0-100 scale for percentages; otherwise fitted to the values. */
  percent?: boolean;
  /** Line colour; by default green when the last change is up, red when down. */
  color?: string;
  /** Soft area under the line. */
  area?: boolean;
  className?: string;
  label?: string;
  /** Fill the container's width (the line is stretched, not scaled). */
  stretch?: boolean;
  /** With `percent` off: start the scale at zero rather than at the lowest value. */
  fromZero?: boolean;
}

/** A tiny line chart of a series (tests, weeks, sittings) with the last point marked. */
export function Sparkline({
  values,
  width = 64,
  height = 20,
  percent = true,
  color,
  area = true,
  className,
  label,
  stretch = false,
  fromZero = false,
}: SparklineProps) {
  const gradient = `spark-${useId().replace(/:/g, '')}`;
  const points = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => typeof point.value === 'number');
  if (points.length < 2) return null;

  const min = percent || fromZero ? 0 : Math.min(...points.map((point) => point.value));
  const max = percent ? 100 : Math.max(...points.map((point) => point.value));
  const span = max - min || 1;
  const pad = 2.5;
  const x = (index: number) => pad + (index / (values.length - 1)) * (width - pad * 2);
  const y = (value: number) => pad + (1 - (value - min) / span) * (height - pad * 2);
  const line = points
    .map((point) => `${x(point.index).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(' ');
  const stroke = color ?? toneFor(lastChange(values));
  const last = points[points.length - 1];

  return (
    <svg
      width={stretch ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={stretch ? 'none' : undefined}
      className={cn('overflow-visible', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon
            points={`${x(points[0].index)},${height} ${line} ${x(last.index)},${height}`}
            fill={`url(#${gradient})`}
          />
        </>
      )}
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="spark-draw"
        pathLength={1}
      />
      {!stretch && <circle cx={x(last.index)} cy={y(last.value)} r={2.4} fill={stroke} />}
    </svg>
  );
}

/** "↑ +6" / "↓ −4" / "→" for the latest change. */
export function TrendDelta({
  values,
  unit = '',
  className,
  title,
}: {
  values: (number | null | undefined)[];
  unit?: string;
  className?: string;
  title?: string;
}) {
  const change = lastChange(values);
  if (change === null) return null;
  const Icon = change === 0 ? ArrowRight : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center text-[11px] font-semibold tabular-nums',
        change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-600' : 'text-slate-400',
        className
      )}
    >
      <Icon className="size-3" aria-hidden />
      {change > 0 ? `+${change}${unit}` : change < 0 ? `${change}${unit}` : ''}
    </span>
  );
}
