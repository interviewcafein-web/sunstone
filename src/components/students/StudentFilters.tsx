import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  GraduationCap,
  Layers,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import type { StudentsSearch } from '@/routes/index';
import { cn } from '@/lib/utils';

type FilterKey = 'campus' | 'course' | 'batch' | 'placed' | 'group';

interface StudentFiltersProps {
  search: StudentsSearch;
  /** Each filter's values; a filter without values is not shown. */
  options: Record<FilterKey, string[]>;
  onChange: (patch: Partial<StudentsSearch>) => void;
}

const PLACED_LABELS: Record<string, string> = {
  placed: 'Placed or Interning',
  'full-time': 'Placed (Full-Time)',
  internship: 'Internship',
  none: 'No Offer Yet',
};

/** "coe:" → "Centre of Excellence", "coe:DE Tech" → "COE: DE Tech"; LMS cohorts as they are. */
export const groupLabel = (value: string) =>
  value === 'coe:'
    ? 'Centre of Excellence'
    : value.startsWith('coe:')
      ? `COE: ${value.slice(4)}`
      : value;

const FILTERS: {
  key: FilterKey;
  label: string;
  all: string;
  icon: LucideIcon;
  labelOf?: (value: string) => string;
}[] = [
  { key: 'campus', label: 'Campus', all: 'All Campuses', icon: Building2 },
  { key: 'batch', label: 'Batch', all: 'All Batches', icon: GraduationCap },
  { key: 'course', label: 'Course', all: 'All Courses', icon: BookOpen },
  {
    key: 'placed',
    label: 'Placement',
    all: 'Everyone',
    icon: BriefcaseBusiness,
    labelOf: (value) => PLACED_LABELS[value] ?? value,
  },
  { key: 'group', label: 'Cohort / COE', all: 'All Students', icon: Layers, labelOf: groupLabel },
];

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

export function StudentFilters({ search, options, onChange }: StudentFiltersProps) {
  const chips = [
    ...FILTERS.filter(({ key }) => search[key]).map(({ key, label, icon, labelOf }) => ({
      key,
      label,
      icon,
      value:
        key === 'batch' ? `Batch ${search[key]}` : labelOf ? labelOf(search[key]!) : search[key]!,
    })),
    ...(search.q
      ? [{ key: 'q' as const, label: 'Name', icon: Search, value: `“${search.q}”` }]
      : []),
  ];

  return (
    <div className="shadow-card bg-surface rounded-2xl border border-slate-200 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.7fr_0.9fr_0.9fr_1.1fr_1.2fr_1.5fr]">
        {FILTERS.filter(({ key }) => options[key].length || search[key]).map(
          ({ key, label, all, icon: Icon, labelOf }) => {
            const on = Boolean(search[key]);
            return (
              <div key={key}>
                <label
                  htmlFor={`filter-${key}`}
                  className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-500 uppercase"
                >
                  {label}
                </label>
                <div className="relative">
                  <Icon className={iconClass(on)} aria-hidden />
                  <select
                    id={`filter-${key}`}
                    value={search[key] ?? ''}
                    onChange={(event) => onChange({ [key]: event.target.value || undefined })}
                    className={field(on)}
                  >
                    <option value="">{all}</option>
                    {/* Keep a filter from a shared link selectable even if the sheet no longer has it. */}
                    {search[key] && !options[key].includes(search[key]) && (
                      <option value={search[key]}>
                        {labelOf ? labelOf(search[key]) : search[key]}
                      </option>
                    )}
                    {options[key].map((option) => (
                      <option key={option} value={option}>
                        {labelOf ? labelOf(option) : option}
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
          }
        )}

        <div>
          <label
            htmlFor="filter-q"
            className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-500 uppercase"
          >
            Student
          </label>
          <div className="relative">
            <Search className={iconClass(Boolean(search.q))} aria-hidden />
            <input
              id="filter-q"
              type="search"
              value={search.q ?? ''}
              onChange={(event) => onChange({ q: event.target.value || undefined })}
              placeholder="Search by name"
              autoComplete="off"
              className={cn(field(Boolean(search.q)), 'pr-3')}
            />
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="animate-rise mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Showing
          </span>
          {chips.map(({ key, label, icon: Icon, value }) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ [key]: undefined })}
              title={`Remove the ${label.toLowerCase()} filter`}
              className="group bg-brand-500/10 text-brand-800 dark:text-brand-100 hover:bg-brand-500/20 inline-flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-2.5 text-xs font-semibold transition"
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
                onChange({ campus: undefined, course: undefined, batch: undefined, q: undefined })
              }
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
