import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Crown, Layers } from 'lucide-react';

import { CountUp } from '@/components/common/CountUp';
import { Sparkline, lastChange } from '@/components/common/Sparkline';
import { scoreFill, scoreTone } from '@/lib/assessments';
import { cn } from '@/lib/utils';

import { cohortDisplay, isSuper100Cohort } from '../lib/subjects';

/** A white (navy, in the dark theme) card. */
export const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';

/** The figures on a banner: two across on phones (the fifth spans both), five on wider screens. */
export const heroGrid =
  'relative grid grid-cols-2 gap-3 md:grid-cols-5 [&>:nth-child(5)]:col-span-2 md:[&>:nth-child(5)]:col-span-1';

/** Converge's gold, from the logo. */
export const GOLD = '#c8913a';

/**
 * The navy banner at the top of each page, with the logo's gold lines: one above the eyebrow,
 * one running off to the right, and the Converge figure as a faint watermark.
 */
export function Hero({
  eyebrow,
  title,
  children,
  aside,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'hero-glow from-brand-700 via-brand-800 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7',
        className
      )}
    >
      <img
        src="/converge-mark-white.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-8 -bottom-10 w-56 opacity-[0.06] select-none sm:w-72"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-7 right-0 hidden h-px w-1/3 bg-gradient-to-r from-transparent to-[#d9a54a]/60 sm:block"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[#e9c27a] uppercase">
              <span aria-hidden className="h-px w-6 bg-[#d9a54a]" />
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A figure on the navy banner. Numbers count up; text values show as they are. */
export function HeroStat({
  icon: Icon,
  label,
  value,
  suffix,
  note,
  trend,
  gold = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string | null;
  /** After a counted number, e.g. "%". */
  suffix?: string;
  note?: string;
  /** Oldest first, drawn faintly behind the figure. */
  trend?: (number | null)[];
  /** The Super 100 tile: gold instead of white glass. */
  gold?: boolean;
}) {
  const change = trend ? lastChange(trend) : null;
  return (
    <div
      className={cn(
        'hover-lift relative flex flex-col-reverse overflow-hidden rounded-xl border p-3 backdrop-blur-sm',
        gold ? 'border-[#e9c27a]/40 bg-[#d9a54a]/15' : 'border-white/15 bg-white/10'
      )}
    >
      <dt className="text-brand-100 mt-0.5 flex items-center gap-1.5 text-xs">
        <Icon className={cn('size-3.5', gold ? 'text-[#e9c27a]' : 'text-brand-200')} aria-hidden />
        <span className="truncate">{label}</span>
        {change !== null && change !== 0 && (
          <span
            className={cn(
              'ml-auto font-semibold',
              change > 0 ? 'text-emerald-300' : 'text-red-300'
            )}
            title="Change since the previous week"
          >
            {change > 0 ? '▲' : '▼'} {Math.abs(change)}
          </span>
        )}
      </dt>
      <dd className="text-2xl font-bold whitespace-nowrap tabular-nums">
        {value === null ? (
          '—'
        ) : typeof value === 'number' ? (
          <>
            <CountUp value={value} />
            {suffix}
          </>
        ) : (
          value
        )}
        {note && (
          <span className="text-brand-200 ml-1 text-sm font-medium whitespace-normal">{note}</span>
        )}
      </dd>
      {trend && trend.filter((point) => point !== null).length > 1 && (
        <Sparkline
          values={trend}
          width={200}
          height={30}
          stretch
          color="rgb(255 255 255 / 0.9)"
          className="pointer-events-none absolute inset-x-0 bottom-0 opacity-30"
        />
      )}
    </div>
  );
}

/** A figure on a white card. */
export function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  trend,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  trend?: (number | null)[];
  /** A coloured strip along the top. */
  accent?: string;
}) {
  return (
    <div className={cn(panel, 'hover-lift relative overflow-hidden p-4')}>
      {accent && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg, ${accent}, ${accent}44)` }}
        />
      )}
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className={cn('text-2xl font-bold tabular-nums', tone)}>{value}</p>
        {trend && <Sparkline values={trend} width={72} height={24} />}
      </div>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** A card heading: title, optional description and something on the right. */
export function SectionTitle({
  icon: Icon,
  title,
  description,
  aside,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {Icon && <Icon className="text-brand-700 dark:text-brand-300 size-4.5" aria-hidden />}
          {title}
        </h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {aside && <div className="text-xs text-slate-500">{aside}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={cn(panel, 'border-dashed p-8 text-center')}>
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
    </div>
  );
}

export function Problem({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:text-red-200"
    >
      <p className="font-semibold">Something did not load.</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="bg-surface mt-3 rounded-md border border-red-300 px-3 py-1.5 font-medium hover:bg-red-50"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/** The gold Super 100 badge. */
export function SuperBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      title="Super 100 cohort"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#e9c27a] to-[#c8913a] font-bold text-[#3b2a0c] shadow-sm',
        size === 'sm' ? 'px-1.5 py-px text-[10px]' : 'px-2.5 py-0.5 text-xs'
      )}
    >
      <Crown className={size === 'sm' ? 'size-2.5' : 'size-3.5'} aria-hidden />
      Super 100
    </span>
  );
}

/** An LMS cohort as a badge; Super 100 cohorts in gold. */
export function CohortBadge({ cohort, onDark = false }: { cohort: string; onDark?: boolean }) {
  if (isSuper100Cohort(cohort)) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#e9c27a] to-[#c8913a] px-2.5 py-0.5 text-xs font-bold text-[#3b2a0c]"
        title={cohort}
      >
        <Crown className="size-3.5" aria-hidden />
        {cohortDisplay(cohort)}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        onDark
          ? 'bg-white/15 text-white ring-1 ring-white/20'
          : 'bg-brand-500/10 text-brand-800 dark:text-brand-100'
      )}
      title={cohort}
    >
      <Layers className="size-3.5" aria-hidden />
      {cohortDisplay(cohort)}
    </span>
  );
}

/** A score (%) with its colour and a thin bar; "—" when there is none. */
export function ScoreCell({
  value,
  hint,
  title,
  muted = false,
}: {
  value: number | null;
  hint?: string;
  title?: string;
  muted?: boolean;
}) {
  if (value === null) return <span className="text-slate-300">—</span>;
  return (
    <span className="inline-flex flex-col items-end" title={title}>
      <span className={cn('font-bold tabular-nums', muted ? 'text-slate-600' : scoreTone(value))}>
        {value}%
      </span>
      <span className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(3, Math.min(100, value))}%`, background: scoreFill(value) }}
        />
      </span>
      {hint && <span className="mt-0.5 text-[11px] whitespace-nowrap text-slate-500">{hint}</span>}
    </span>
  );
}

/** Underlined tabs; the open one is marked for screen readers too. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; icon: LucideIcon; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="scrollbar-none relative flex gap-1 overflow-x-auto border-b border-slate-200"
    >
      {tabs.map(({ id, label: text, icon: Icon, count }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-current={value === id ? 'page' : undefined}
          className={cn(
            '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition',
            value === id
              ? 'border-brand-700 text-brand-700 dark:text-brand-300 dark:border-brand-300'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          )}
        >
          <Icon className="size-4" aria-hidden />
          {text}
          {count !== undefined && (
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600 tabular-nums">
              {count}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
