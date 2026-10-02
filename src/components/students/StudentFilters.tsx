import { Search, X } from 'lucide-react';

import type { StudentsSearch } from '@/routes/index';

type FilterKey = 'campus' | 'course' | 'batch';

interface StudentFiltersProps {
  search: StudentsSearch;
  options: Record<FilterKey, string[]>;
  onChange: (patch: Partial<StudentsSearch>) => void;
}

const FILTERS: { key: FilterKey; label: string; all: string }[] = [
  { key: 'campus', label: 'Campus', all: 'All campuses' },
  { key: 'batch', label: 'Batch', all: 'All batches' },
  { key: 'course', label: 'Course', all: 'All courses' },
];

const field =
  'focus-visible:outline-brand-500 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1';

export function StudentFilters({ search, options, onChange }: StudentFiltersProps) {
  const active = FILTERS.some(({ key }) => search[key]) || Boolean(search.q);

  return (
    <div className="shadow-card grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.5fr_auto] lg:items-end">
      {FILTERS.map(({ key, label, all }) => (
        <div key={key}>
          <label
            htmlFor={`filter-${key}`}
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            {label}
          </label>
          <select
            id={`filter-${key}`}
            value={search[key] ?? ''}
            onChange={(event) => onChange({ [key]: event.target.value || undefined })}
            className={field}
          >
            <option value="">{all}</option>
            {/* Keep a filter from a shared link selectable even if the sheet no longer has it. */}
            {search[key] && !options[key].includes(search[key]) && (
              <option value={search[key]}>{search[key]}</option>
            )}
            {options[key].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div>
        <label htmlFor="filter-q" className="mb-1 block text-xs font-medium text-slate-600">
          Student
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            id="filter-q"
            type="search"
            value={search.q ?? ''}
            onChange={(event) => onChange({ q: event.target.value || undefined })}
            placeholder="Search by name"
            autoComplete="off"
            className={`${field} pl-9`}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={!active}
        onClick={() =>
          onChange({ campus: undefined, course: undefined, batch: undefined, q: undefined })
        }
        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
      >
        <X className="size-4" aria-hidden />
        Clear
      </button>
    </div>
  );
}
