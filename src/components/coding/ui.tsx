import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn('shadow-card rounded-2xl border border-slate-200 bg-surface p-5', className)}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {aside && <div className="text-xs text-slate-500">{aside}</div>}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 transition',
            option.value === value && 'bg-surface text-slate-900 shadow-sm'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const formatNumber = (value: number) => value.toLocaleString('en-IN');

export function formatDate(seconds: number, withTime = false) {
  const date = new Date(seconds * 1000);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}
