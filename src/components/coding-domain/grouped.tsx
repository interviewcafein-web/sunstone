// Campus grouping for the PRIME Coding tables: a bold college row that folds, the program and
// batch rows under it, and a batch's students when it is opened. Student lists group the same
// way (college, then program and batch, then the students).

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import type { CodingStudent } from '@/lib/codingDomain';
import { cohortLabel, compareProgram } from '@/lib/cohorts';
import { cn } from '@/lib/utils';

/** Which rows are open: every row starts open or closed, and a click flips it. */
export function useFold(defaultOpen = false) {
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  return {
    isOpen: (key: string) => defaultOpen !== flipped.has(key),
    toggle: (key: string) =>
      setFlipped((previous) => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
  };
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={cn('size-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-90')}
      aria-hidden
    />
  );
}

/** Programs in HQ's order (B.Tech/BE, BCA, MCA), then the senior batch first. */
export const compareBatch = (
  a: { program: string; year: number | null },
  b: { program: string; year: number | null }
) => compareProgram(a.program, b.program) || (a.year ?? 0) - (b.year ?? 0);

export function groupBy<T>(items: T[], keyOf: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return [...map];
}

// --- Summary tables: college → program and batch → students ---------------------------------

export interface CampusGroup<R> {
  campus: string;
  total: R;
  rows: R[];
}

/**
 * Table body for a summary table: each college in bold with its totals (folds), its program and
 * batch rows under it, and, when `students` is given, a batch's students under the batch.
 */
export function CampusRows<R>({
  groups,
  rowKey,
  label,
  cells,
  students,
  colSpan,
}: {
  groups: CampusGroup<R>[];
  rowKey: (row: R) => string;
  /** The first cell of a batch row. */
  label: (row: R) => ReactNode;
  /** The other cells of a batch or college row. */
  cells: (row: R, campus: boolean) => ReactNode;
  students?: (row: R) => ReactNode;
  colSpan: number;
}) {
  const campuses = useFold(true);
  const batches = useFold(false);
  return (
    <tbody>
      {groups.map((group) => {
        const open = campuses.isOpen(group.campus);
        return (
          <Fragment key={group.campus}>
            <tr
              onClick={() => campuses.toggle(group.campus)}
              className="cursor-pointer border-b border-slate-200 bg-slate-50 font-semibold hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
            >
              <td className="py-2 pr-2 pl-1">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={(event) => {
                    event.stopPropagation();
                    campuses.toggle(group.campus);
                  }}
                  className="flex items-center gap-1.5 text-left font-bold text-slate-900 dark:text-slate-50"
                >
                  <Chevron open={open} />
                  {group.campus}
                </button>
              </td>
              {cells(group.total, true)}
            </tr>
            {open &&
              group.rows.map((row) => {
                const key = `${group.campus}|${rowKey(row)}`;
                const expanded = Boolean(students) && batches.isOpen(key);
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={students ? () => batches.toggle(key) : undefined}
                      className={cn(
                        'border-b border-slate-100',
                        students && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30',
                        expanded && 'bg-brand-50/40 dark:bg-brand-900/10'
                      )}
                    >
                      <td className="py-2 pr-2 pl-6">
                        {students ? (
                          <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={(event) => {
                              event.stopPropagation();
                              batches.toggle(key);
                            }}
                            className="flex items-center gap-1.5 text-left font-medium"
                          >
                            <Chevron open={expanded} />
                            {label(row)}
                          </button>
                        ) : (
                          <span className="font-medium">{label(row)}</span>
                        )}
                      </td>
                      {cells(row, false)}
                    </tr>
                    {expanded && (
                      <tr className="border-b border-slate-100">
                        <td
                          colSpan={colSpan}
                          className="bg-slate-50/60 px-3 py-3 pl-11 dark:bg-slate-900/30"
                        >
                          {students!(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </Fragment>
        );
      })}
    </tbody>
  );
}

export interface MiniColumn<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  right?: boolean;
}

/** A small table of students inside an opened batch. */
export function MiniTable<T>({
  rows,
  rowKey,
  columns,
  empty = 'No students.',
}: {
  rows: T[];
  rowKey: (row: T) => string;
  columns: MiniColumn<T>[];
  empty?: string;
}) {
  const [limit, setLimit] = useState(30);
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="bg-surface w-full rounded-lg text-xs ring-1 ring-slate-200">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {columns.map((column, index) => (
              <th
                key={index}
                className={cn(
                  'px-2 py-1.5 font-semibold whitespace-nowrap',
                  column.right && 'text-right'
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((row) => (
            <tr key={rowKey(row)} className="border-b border-slate-100 last:border-0">
              {columns.map((column, index) => (
                <td
                  key={index}
                  className={cn('px-2 py-1.5', column.right && 'text-right tabular-nums')}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((current) => current + 100)}
          className="text-brand-700 mt-2 text-xs font-semibold hover:underline"
        >
          Show More ({(rows.length - limit).toLocaleString('en-IN')} left)
        </button>
      )}
    </div>
  );
}

// --- Student lists: college → program and batch → students -----------------------------------

interface BatchGroup<T> {
  key: string;
  program: string;
  year: number | null;
  items: T[];
}

/**
 * Table body for a student list, grouped by college and then program and batch (just program and
 * batch when one campus is in view). Groups start closed; `forceOpen` opens them all (a search).
 * The items keep their order inside each group.
 */
export function StudentGroups<T>({
  items,
  studentOf,
  allCampuses,
  colSpan,
  renderRow,
  summary,
  forceOpen = false,
}: {
  items: T[];
  studentOf: (item: T) => CodingStudent;
  allCampuses: boolean;
  colSpan: number;
  renderRow: (item: T) => ReactNode;
  summary?: (items: T[]) => ReactNode;
  forceOpen?: boolean;
}) {
  const campuses = useFold(false);
  const batches = useFold(false);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const tree = useMemo(
    () =>
      groupBy(items, (item) => (allCampuses ? studentOf(item).campus : ''))
        .map(([campus, list]) => ({
          campus,
          items: list,
          batches: groupBy(list, (item) => {
            const row = studentOf(item);
            return `${row.program}|${row.year ?? ''}`;
          })
            .map(
              ([key, rows]): BatchGroup<T> => ({
                key,
                program: studentOf(rows[0]).program,
                year: studentOf(rows[0]).year,
                items: rows,
              })
            )
            .sort(compareBatch),
        }))
        .sort((a, b) => a.campus.localeCompare(b.campus)),
    [items, allCampuses, studentOf]
  );

  const header = (
    key: string,
    level: 0 | 1,
    label: string,
    list: T[],
    open: boolean,
    toggle: () => void
  ) => (
    <tr
      key={`${key}-head`}
      onClick={toggle}
      className={cn(
        'cursor-pointer border-b',
        level === 0
          ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800'
          : 'border-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30'
      )}
    >
      <td colSpan={colSpan} className={cn('py-2 pr-2', level === 0 ? 'pl-1' : 'pl-6')}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <button
            type="button"
            aria-expanded={open}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
            className={cn(
              'flex items-center gap-1.5 text-left',
              level === 0
                ? 'font-bold text-slate-900 dark:text-slate-50'
                : 'font-semibold text-slate-700 dark:text-slate-200'
            )}
          >
            <Chevron open={open} />
            {label}
          </button>
          <span className="text-xs text-slate-500 tabular-nums">
            {list.length.toLocaleString('en-IN')} student{list.length === 1 ? '' : 's'}
          </span>
          {summary && <span className="text-xs text-slate-500">· {summary(list)}</span>}
        </span>
      </td>
    </tr>
  );

  const batchRows = (prefix: string, batch: BatchGroup<T>, level: 0 | 1) => {
    const key = `${prefix}|${batch.key}`;
    const open = forceOpen || batches.isOpen(key);
    const limit = limits[key] ?? 50;
    return (
      <Fragment key={key}>
        {header(key, level, cohortLabel(batch.program, batch.year), batch.items, open, () =>
          batches.toggle(key)
        )}
        {open && batch.items.slice(0, limit).map(renderRow)}
        {open && batch.items.length > limit && (
          <tr>
            <td colSpan={colSpan} className="py-2 text-center">
              <button
                type="button"
                onClick={() => setLimits((current) => ({ ...current, [key]: limit + 200 }))}
                className="text-brand-700 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold"
              >
                Show More ({(batch.items.length - limit).toLocaleString('en-IN')} left)
              </button>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <tbody>
      {allCampuses
        ? tree.map((campus) => {
            const open = forceOpen || campuses.isOpen(campus.campus);
            return (
              <Fragment key={campus.campus}>
                {header(campus.campus, 0, campus.campus, campus.items, open, () =>
                  campuses.toggle(campus.campus)
                )}
                {open && campus.batches.map((batch) => batchRows(campus.campus, batch, 1))}
              </Fragment>
            );
          })
        : tree.flatMap((campus) => campus.batches).map((batch) => batchRows('', batch, 0))}
    </tbody>
  );
}
