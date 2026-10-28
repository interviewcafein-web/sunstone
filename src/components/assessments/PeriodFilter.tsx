import { CalendarRange, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The year and term a test (or AMCAT round) belongs to, from its LMS date ("2026-10-27 …").
 * Terms follow the academic halves the exams use: 1 = Jan–Jun, 2 = Jul–Dec.
 */
export function periodOf(date: string | null | undefined): { year: number; term: 1 | 2 } | null {
  const match = date?.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), term: Number(match[2]) >= 7 ? 2 : 1 };
}

export interface PeriodChoice {
  year?: number;
  term?: 1 | 2;
  q?: string;
}

/** True when the date (and name) fit the chosen year, term and search. Undated items only
 *  show while no year or term is chosen. */
export function inPeriod(date: string | null | undefined, name: string, choice: PeriodChoice) {
  if (choice.q && !name.toLowerCase().includes(choice.q.toLowerCase())) return false;
  if (!choice.year && !choice.term) return true;
  const period = periodOf(date);
  if (!period) return false;
  return (
    (!choice.year || period.year === choice.year) && (!choice.term || period.term === choice.term)
  );
}

export const TERMS: Record<1 | 2, string> = { 1: 'Jan–Jun', 2: 'Jul–Dec' };

const chip = (on: boolean) =>
  cn(
    'rounded-full px-3 py-1 text-xs font-semibold transition',
    on
      ? 'bg-brand-700 text-white shadow-sm'
      : 'bg-surface text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
  );

/**
 * Year and term chips plus a name search, for lists of tests or AMCAT rounds. `dates` are the
 * items' dates, to offer only the years that have something.
 */
export function PeriodFilter({
  dates,
  choice,
  onChange,
  shown,
  total,
  noun = 'tests',
  searchable = true,
}: {
  dates: (string | null | undefined)[];
  choice: PeriodChoice;
  onChange: (next: PeriodChoice) => void;
  shown: number;
  total: number;
  noun?: string;
  searchable?: boolean;
}) {
  const years = [
    ...new Set(dates.map((date) => periodOf(date)?.year).filter((year): year is number => !!year)),
  ].sort((a, b) => b - a);
  const active = Boolean(choice.year || choice.term || choice.q);

  return (
    <div className="shadow-card bg-surface flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 px-4 py-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <CalendarRange className="size-4" aria-hidden />
        Period
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Year">
        <button
          type="button"
          className={chip(!choice.year)}
          onClick={() => onChange({ ...choice, year: undefined })}
        >
          All years
        </button>
        {years.map((year) => (
          <button
            key={year}
            type="button"
            aria-pressed={choice.year === year}
            className={chip(choice.year === year)}
            onClick={() => onChange({ ...choice, year })}
          >
            {year}
          </button>
        ))}
      </div>
      <span aria-hidden className="hidden h-5 w-px bg-slate-200 sm:block" />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Term">
        <button
          type="button"
          className={chip(!choice.term)}
          onClick={() => onChange({ ...choice, term: undefined })}
        >
          Both terms
        </button>
        {([1, 2] as const).map((term) => (
          <button
            key={term}
            type="button"
            aria-pressed={choice.term === term}
            className={chip(choice.term === term)}
            onClick={() => onChange({ ...choice, term })}
          >
            {TERMS[term]}
          </button>
        ))}
      </div>
      {searchable && (
        <label className="relative ml-auto min-w-48 flex-1 sm:max-w-64">
          <span className="sr-only">Search by name</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={choice.q ?? ''}
            onChange={(event) => onChange({ ...choice, q: event.target.value || undefined })}
            placeholder={`Search ${noun}`}
            className="focus-visible:outline-brand-500 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm focus-visible:outline-2"
          />
        </label>
      )}
      <span className={cn('text-xs text-slate-500 tabular-nums', !searchable && 'ml-auto')}>
        {active ? `${shown} of ${total} ${noun}` : `${total} ${noun}`}
        {active && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-brand-700 dark:text-brand-300 ml-2 inline-flex items-center gap-0.5 font-semibold hover:underline"
          >
            <X className="size-3" aria-hidden />
            Clear
          </button>
        )}
      </span>
    </div>
  );
}
