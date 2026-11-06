import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Building2,
  ChevronDown,
  Crown,
  GraduationCap,
  Layers,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { batchLabel } from '@/lib/cohorts';
import { cn } from '@/lib/utils';

import { cohortDisplay } from '../lib/subjects';

export interface FilterValues {
  campus?: string;
  program?: string;
  batch?: string;
  cohort?: string;
  q?: string;
  super?: boolean;
}

type SelectKey = 'campus' | 'program' | 'batch' | 'cohort';

export interface FilterOptions {
  campus: string[];
  program: string[];
  /** Batch filter values, "BBA:2025". */
  batch: string[];
  /** Absent: no cohort filter (e.g. on the Super 100 page). */
  cohort?: string[];
}

const SELECTS: { key: SelectKey; label: string; all: string; icon: LucideIcon }[] = [
  { key: 'campus', label: 'Campus', all: 'All Campuses', icon: Building2 },
  { key: 'program', label: 'Program', all: 'BBA and MBA', icon: BookOpen },
  { key: 'batch', label: 'Batch', all: 'All Batches', icon: GraduationCap },
  { key: 'cohort', label: 'Cohort', all: 'All Cohorts', icon: Layers },
];

const shown = (key: SelectKey, value: string) =>
  key === 'batch' ? batchLabel(value) : key === 'cohort' ? cohortDisplay(value) : value;

/** A field with its icon inside; tinted when it holds a filter. */
const field = (on: boolean) =>
  cn(
    'focus-visible:outline-brand-500 h-11 w-full appearance-none rounded-xl border pr-9 pl-10 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1',
    on
      ? 'border-brand-400 bg-brand-500/10 text-brand-800 dark:text-brand-100 shadow-sm'
      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-surface'
  );

const iconClass = (on: boolean) =>
  cn(
    'pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 transition',
    on ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400'
  );

const labelClass = 'mb-1 block text-[11px] font-semibold tracking-wide text-slate-500 uppercase';

/** Campus, program, batch (and cohort) pickers, a name search and the Super 100 switch. */
export function StudentFilters({
  values,
  options,
  onChange,
  superToggle = true,
}: {
  values: FilterValues;
  options: FilterOptions;
  onChange: (patch: Partial<FilterValues>) => void;
  superToggle?: boolean;
}) {
  const selects = SELECTS.filter(({ key }) => key !== 'cohort' || options.cohort);
  const chips = [
    ...selects
      .filter(({ key }) => values[key])
      .map(({ key, label, icon }) => ({
        key: key as keyof FilterValues,
        label,
        icon,
        value: shown(key, values[key]!),
      })),
    ...(values.super
      ? [{ key: 'super' as const, label: 'Super 100', icon: Crown, value: 'Super 100 Only' }]
      : []),
    ...(values.q
      ? [{ key: 'q' as const, label: 'Name', icon: Search, value: `“${values.q}”` }]
      : []),
  ];

  return (
    <div className="shadow-card bg-surface rounded-2xl border border-slate-200 p-4">
      <div
        className={cn(
          'grid gap-3 sm:grid-cols-2',
          selects.length === 4
            ? 'lg:grid-cols-[1.6fr_1fr_1fr_1fr_1.5fr]'
            : 'lg:grid-cols-[1.6fr_1fr_1fr_1.5fr]'
        )}
      >
        {selects.map(({ key, label, all, icon: Icon }) => {
          const on = Boolean(values[key]);
          const list = options[key] ?? [];
          return (
            <div key={key}>
              <label htmlFor={`filter-${key}`} className={labelClass}>
                {label}
              </label>
              <div className="relative">
                <Icon className={iconClass(on)} aria-hidden />
                <select
                  id={`filter-${key}`}
                  value={values[key] ?? ''}
                  onChange={(event) => {
                    const value = event.target.value || undefined;
                    // A new program clears a batch from another program.
                    if (key === 'program') {
                      const keep = values.batch?.startsWith(`${value}:`);
                      onChange({ program: value, batch: keep ? values.batch : undefined });
                    } else onChange({ [key]: value });
                  }}
                  className={field(on)}
                >
                  <option value="">{all}</option>
                  {values[key] && !list.includes(values[key]!) && (
                    <option value={values[key]}>{shown(key, values[key]!)}</option>
                  )}
                  {list.map((option) => (
                    <option key={option} value={option}>
                      {shown(key, option)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
            </div>
          );
        })}

        <div>
          <label htmlFor="filter-q" className={labelClass}>
            Student
          </label>
          <div className="relative">
            <Search className={iconClass(Boolean(values.q))} aria-hidden />
            <input
              id="filter-q"
              type="search"
              value={values.q ?? ''}
              onChange={(event) => onChange({ q: event.target.value || undefined })}
              placeholder="Search by name"
              autoComplete="off"
              className={cn(field(Boolean(values.q)), 'pr-3')}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-3">
        {superToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(values.super)}
            onClick={() => onChange({ super: values.super ? undefined : true })}
            className={cn(
              'inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs font-semibold ring-1 transition',
              values.super
                ? 'bg-gradient-to-r from-[#f3d9a4] to-[#e9c27a] text-[#3b2a0c] ring-[#c8913a]/50'
                : 'bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'relative h-5 w-9 rounded-full transition',
                values.super ? 'bg-[#a8741f]' : 'bg-slate-300'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 flex size-4 items-center justify-center rounded-full bg-white shadow transition-transform',
                  values.super && 'translate-x-4'
                )}
              >
                <Crown className="size-2.5 text-[#a8741f]" />
              </span>
            </span>
            Super 100 Only
          </button>
        )}
        {chips.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Showing
          </span>
        )}
        {chips.map(({ key, label, icon: Icon, value }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ [key]: undefined })}
            title={`Remove the ${label.toLowerCase()} filter`}
            className="group bg-brand-500/10 text-brand-800 dark:text-brand-100 hover:bg-brand-500/20 animate-rise inline-flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-2.5 text-xs font-semibold transition"
          >
            <Icon className="size-3.5 opacity-70" aria-hidden />
            {value}
            <span className="flex size-4 items-center justify-center rounded-full bg-white/70 transition group-hover:bg-white dark:bg-white/20">
              <X className="size-3" aria-hidden />
            </span>
          </button>
        ))}
        {chips.length > 1 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                campus: undefined,
                program: undefined,
                batch: undefined,
                cohort: undefined,
                q: undefined,
                super: undefined,
              })
            }
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
