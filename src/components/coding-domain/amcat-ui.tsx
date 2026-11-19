// Small building blocks shared by the AMCAT and Movement tabs of the PRIME Coding page.

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { placedLabel, type CodingStudent } from '@/lib/codingDomain';
import { cn } from '@/lib/utils';

export const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';
export const BRAND = 'var(--color-brand-600)';
export const th = 'px-2 py-2 text-right font-semibold whitespace-nowrap';
export const td = 'px-2 py-2 text-right tabular-nums';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn(panel, 'p-5', className)}>{children}</section>;
}

export function Title({
  icon: Icon,
  title,
  description,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon className="text-brand-700 dark:text-brand-300 size-4.5" aria-hidden />
          {title}
        </h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </div>
  );
}

/** A bar 0–100. */
export function Bar({
  pct,
  color = BRAND,
  className,
}: {
  pct: number | null;
  color?: string;
  className?: string;
}) {
  return (
    <span className={cn('block h-2 overflow-hidden rounded-full bg-slate-100', className)}>
      <span
        className="block h-full rounded-full transition-all"
        style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%`, background: color }}
      />
    </span>
  );
}

/** An AMCAT module or skill score, coloured against the pass mark. */
export function AmcatScore({ value, pass }: { value: number | null | undefined; pass: number }) {
  if (value == null) return <span className="text-slate-300">—</span>;
  return (
    <span
      className={cn(
        'font-semibold tabular-nums',
        value >= pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      )}
    >
      {Number(value.toFixed(1))}
    </span>
  );
}

/** ▲ 3 / ▼ 2 points against the earlier value. */
export function Delta({
  now,
  before,
  unit = '',
}: {
  now: number | null;
  before: number | null;
  unit?: string;
}) {
  if (now == null || before == null) return null;
  const change = Math.round((now - before) * 10) / 10;
  if (!change) return <span className="text-[11px] text-slate-400">±0</span>;
  return (
    <span
      className={cn(
        'text-[11px] font-semibold tabular-nums',
        change > 0 ? 'text-emerald-600' : 'text-red-600'
      )}
    >
      {change > 0 ? '▲' : '▼'} {Math.abs(change)}
      {unit}
    </span>
  );
}

export function TrackBadge({ track }: { track: string | null }) {
  if (!track) return null;
  return (
    <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
      COE · {track}
    </span>
  );
}

export function PlacedBadge({ placed }: { placed: CodingStudent['placed'] }) {
  const label = placedLabel(placed);
  if (!label) return null;
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        placed === 'full-time'
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
      )}
    >
      {label}
    </span>
  );
}

export function ShowMore({ left, onMore }: { left: number; onMore: () => void }) {
  if (left <= 0) return null;
  return (
    <div className="mt-3 text-center">
      <button
        type="button"
        onClick={onMore}
        className="text-brand-700 rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold"
      >
        Show More ({left.toLocaleString('en-IN')} left)
      </button>
    </div>
  );
}

export const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value);
};

export const known = (values: (number | null | undefined)[]) =>
  values.filter((value): value is number => typeof value === 'number');
