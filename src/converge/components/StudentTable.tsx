import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  Award,
  BriefcaseBusiness,
  Calculator,
  CalendarCheck,
  MessagesSquare,
  NotebookPen,
} from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { ExportButtons } from '@/components/common/ExportButtons';
import { Sparkline } from '@/components/common/Sparkline';
import { StatusTags } from '@/components/students/StatusTags';
import { scoreTone } from '@/lib/assessments';
import { cohortLabel } from '@/lib/cohorts';
import type { ExportColumn } from '@/lib/exportTable';
import { cn } from '@/lib/utils';

import type { Row, SortKey } from '../lib/rows';
import { TRACKS, domainOf } from '../lib/subjects';
import { attendanceFill, attendanceTone } from '../lib/tones';
import { Link } from '../nav';
import { ScoreCell, SuperBadge, panel } from './ui';

const fmtHours = (hours: number | null | undefined) =>
  hours == null ? '0' : Number(hours.toFixed(1)).toLocaleString('en-IN');

// Thousands of rows (every campus) are too many to draw at once: draw a page, then more as
// the reader scrolls near the end.
const PAGE = 60;

const cellBase =
  'border-l border-dotted border-slate-200 px-3 py-3 text-right align-middle transition-colors group-hover/row:bg-[#f3f6fb] dark:group-hover/row:bg-[#17284a]';

export function StudentTable({
  rows,
  sort,
  onSort,
  showCampus = true,
  empty = 'No students match these filters.',
  exportName,
}: {
  rows: Row[];
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  showCampus?: boolean;
  empty?: string;
  /** The download's file name; no download buttons without it. */
  exportName?: string;
}) {
  const [limit, setLimit] = useState(PAGE);
  // A new sort or filter starts again from the top.
  const signature = `${sort}|${rows.length}|${rows[0]?.student.id ?? ''}`;
  useEffect(() => setLimit(PAGE), [signature]);
  const visible = rows.slice(0, limit);
  const more = rows.length - visible.length;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = sentinel.current;
    if (!target || more <= 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLimit((current) => current + PAGE);
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [more, limit]);

  if (!rows.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-600">
        {empty}
      </p>
    );
  }

  const combined = rows.some((row) => row.combined);
  const header = (key: SortKey, label: string, icon: ReactNode, hint: string) => (
    <SortHeader label={label} icon={icon} hint={hint} sortKey={key} sort={sort} onSort={onSort} />
  );

  return (
    <div className={cn(panel, 'overflow-hidden')}>
      {exportName && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
          <p className="text-sm text-slate-600">
            <b className="text-slate-900 dark:text-slate-100">
              {rows.length.toLocaleString('en-IN')}
            </b>{' '}
            student{rows.length === 1 ? '' : 's'}
          </p>
          <ExportButtons name={exportName} sheet="Students" columns={STUDENT_COLUMNS} rows={rows} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[66rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-600">
              <th scope="col" className="w-10 px-3 py-2.5 font-semibold">
                #
              </th>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 font-semibold shadow-[6px_0_8px_-6px_rgb(15_23_42/0.18)] sm:shadow-none"
                aria-sort={sort === 'name' ? 'ascending' : undefined}
              >
                <SortButton
                  label="Student"
                  active={sort === 'name'}
                  onClick={() => onSort('name')}
                />
              </th>
              {header(
                'domain',
                TRACKS.domain.label,
                <BriefcaseBusiness className="text-brand-600 size-3.5" aria-hidden />,
                combined ? 'all PRIME tests, taken' : 'average, taken'
              )}
              {header(
                'comm',
                TRACKS.comm.label,
                <MessagesSquare className="size-3.5 text-violet-600" aria-hidden />,
                'average, taken'
              )}
              {header(
                'apt',
                TRACKS.apt.label,
                <Calculator className="size-3.5 text-fuchsia-600" aria-hidden />,
                'average, taken'
              )}
              {header(
                'amcat',
                'AMCAT',
                <Award className="size-3.5 text-amber-600" aria-hidden />,
                'latest, trend'
              )}
              {header(
                'attendance',
                'Attendance',
                <CalendarCheck className="size-3.5 text-emerald-600" aria-hidden />,
                'all classes, weekly'
              )}
              {header(
                'exams',
                'Internal Exams',
                <NotebookPen className="size-3.5 text-sky-600" aria-hidden />,
                'midterms, end-term'
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const { student, metrics } = row;
              return (
                <tr
                  key={student.id}
                  className="group/row animate-rise border-b border-slate-200 last:border-0"
                  style={{ animationDelay: `${Math.min(index, 15) * 25}ms` }}
                >
                  <td className="px-3 py-3 align-middle text-slate-400 tabular-nums transition-colors group-hover/row:bg-[#f3f6fb] dark:group-hover/row:bg-[#17284a]">
                    {index + 1}
                  </td>
                  <th
                    scope="row"
                    className="bg-surface sticky left-0 z-10 w-44 max-w-44 px-3 py-3 sm:w-auto sm:max-w-[17rem] shadow-[6px_0_8px_-6px_rgb(15_23_42/0.18)] sm:shadow-none text-left align-middle font-normal transition-colors group-hover/row:bg-[#f3f6fb] dark:group-hover/row:bg-[#17284a]"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={student.name} className="hidden sm:inline-flex" />
                      <div className="min-w-0">
                        <Link
                          to="/s/$slug"
                          params={{ slug: student.slug }}
                          className="text-brand-700 dark:text-brand-300 block truncate font-semibold hover:underline"
                        >
                          {student.name}
                        </Link>
                        <div className="truncate text-xs text-slate-500">
                          {[
                            showCampus && student.campus,
                            cohortLabel(student.course, student.batch),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        {(row.super100 || student.status) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {row.super100 && <SuperBadge />}
                            <StatusTags status={student.status} />
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                  <td className={cellBase}>
                    <span className="inline-flex flex-col items-end gap-0.5">
                      {domainOf(metrics?.domain_subjects) && (
                        <span className="bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap">
                          {domainOf(metrics?.domain_subjects)}
                        </span>
                      )}
                      <ScoreCell
                        value={row.domain}
                        hint={taken(
                          row.combined ? metrics?.submitted : metrics?.domain_submitted,
                          row.combined ? metrics?.released : metrics?.domain_released
                        )}
                      />
                      {metrics?.domain_classes ? (
                        <span
                          className="text-[11px] whitespace-nowrap text-slate-500"
                          title={`${metrics.domain_attended} of ${metrics.domain_classes} PRIME domain classes attended`}
                        >
                          {fmtHours(metrics.domain_hours)} h · {metrics.domain_attended}/
                          {metrics.domain_classes} classes
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className={cellBase}>
                    <ScoreCell
                      value={row.comm}
                      hint={taken(metrics?.comm_submitted, metrics?.comm_released)}
                    />
                  </td>
                  <td className={cellBase}>
                    <ScoreCell
                      value={row.apt}
                      hint={taken(metrics?.apt_submitted, metrics?.apt_released)}
                    />
                  </td>
                  <td className={cellBase}>
                    <AmcatCell sittings={metrics?.amcat ?? null} />
                  </td>
                  <td className={cellBase}>
                    <AttendanceCell
                      pct={row.attendance}
                      weeks={metrics?.attendance_weeks ?? null}
                    />
                  </td>
                  <td className={cellBase}>
                    <ScoreCell value={row.exams} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {more > 0 && (
        <div
          ref={sentinel}
          className="flex items-center justify-center gap-3 border-t border-slate-200 px-4 py-4"
        >
          <span className="text-sm text-slate-500">
            Showing {visible.length.toLocaleString('en-IN')} of{' '}
            {rows.length.toLocaleString('en-IN')}
          </span>
          <button
            type="button"
            onClick={() => setLimit((current) => current + PAGE * 4)}
            className="text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/40 rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold"
          >
            Show More
          </button>
        </div>
      )}
      {combined && (
        <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          PRIME Domain shows all PRIME tests for now: the split into domain, communication and
          aptitude appears once the numbers are next refreshed.
        </p>
      )}
    </div>
  );
}

/** Every student row as a spreadsheet: the numbers in the table, without contact details. */
export const STUDENT_COLUMNS: ExportColumn<Row>[] = [
  { header: 'Name', value: (row) => row.student.name },
  { header: 'Username', value: (row) => row.student.slug },
  { header: 'Campus', value: (row) => row.student.campus },
  { header: 'Program', value: (row) => row.student.course },
  { header: 'Batch', value: (row) => cohortLabel(row.student.course, row.student.batch) },
  { header: 'Cohorts', value: (row) => row.student.cohorts?.join(', ') },
  { header: 'Super 100', value: (row) => (row.super100 ? 'Yes' : '') },
  { header: 'PRIME domain', value: (row) => domainOf(row.metrics?.domain_subjects) },
  { header: 'PRIME Domain %', value: (row) => row.domain },
  {
    header: 'PRIME Domain tests taken',
    value: (row) => (row.combined ? row.metrics?.submitted : row.metrics?.domain_submitted),
  },
  {
    header: 'PRIME Domain tests published',
    value: (row) => (row.combined ? row.metrics?.released : row.metrics?.domain_released),
  },
  { header: 'PRIME Domain classes attended', value: (row) => row.metrics?.domain_attended },
  { header: 'PRIME Domain classes held', value: (row) => row.metrics?.domain_classes },
  { header: 'PRIME Domain hours attended', value: (row) => row.metrics?.domain_hours },
  { header: 'Communication %', value: (row) => row.comm },
  { header: 'Communication tests taken', value: (row) => row.metrics?.comm_submitted },
  { header: 'Communication tests released', value: (row) => row.metrics?.comm_released },
  { header: 'Aptitude %', value: (row) => row.apt },
  { header: 'Aptitude tests taken', value: (row) => row.metrics?.apt_submitted },
  { header: 'Aptitude tests released', value: (row) => row.metrics?.apt_released },
  { header: 'AMCAT (latest sitting)', value: (row) => row.amcat },
  { header: 'AMCAT sittings', value: (row) => row.metrics?.amcat?.length ?? 0 },
  { header: 'Attendance %', value: (row) => row.attendance },
  { header: 'PRIME attendance %', value: (row) => row.metrics?.prime_attendance },
  { header: 'Internal exams %', value: (row) => row.exams },
];

const taken = (submitted: number | null | undefined, released: number | null | undefined) =>
  released ? `${submitted ?? 0}/${released} taken` : undefined;

function AmcatCell({ sittings }: { sittings: [string, number][] | null }) {
  if (!sittings?.length) return <span className="text-slate-300">—</span>;
  const latest = sittings[sittings.length - 1];
  return (
    <span
      className="inline-flex flex-col items-end"
      title={sittings.map(([date, score]) => `${date}: ${score}`).join('\n')}
    >
      <span className={cn('font-bold tabular-nums', scoreTone(latest[1]))}>{latest[1]}</span>
      {sittings.length > 1 ? (
        <Sparkline values={sittings.map(([, score]) => score)} width={56} height={16} />
      ) : (
        <span className="h-4" />
      )}
      <span className="text-[11px] text-slate-500">
        {sittings.length} sitting{sittings.length === 1 ? '' : 's'}
      </span>
    </span>
  );
}

function AttendanceCell({ pct, weeks }: { pct: number | null; weeks: number[] | null }) {
  if (pct === null) return <span className="text-slate-300">—</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <span className={cn('font-bold tabular-nums', attendanceTone(pct))}>{pct}%</span>
      {weeks && weeks.length > 1 ? (
        <Sparkline values={weeks} width={56} height={16} color={attendanceFill(pct)} />
      ) : (
        <span className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-slate-100">
          <span
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, background: attendanceFill(pct) }}
          />
        </span>
      )}
    </span>
  );
}

function SortButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hover:text-brand-700 dark:hover:text-brand-300 inline-flex items-center gap-1.5 whitespace-nowrap',
        active && 'text-brand-700 dark:text-brand-300'
      )}
    >
      {icon}
      {label}
      {active && (
        <ArrowDown className={cn('size-3', label === 'Student' && 'rotate-180')} aria-hidden />
      )}
    </button>
  );
}

function SortHeader({
  label,
  icon,
  hint,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  icon: ReactNode;
  hint: string;
  sortKey: SortKey;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
}) {
  const active = sort === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? 'descending' : undefined}
      className="border-l border-dotted border-slate-200 px-3 py-2.5 text-right font-semibold"
    >
      <SortButton label={label} active={active} onClick={() => onSort(sortKey)} icon={icon} />
      <div className="font-normal text-slate-400">{hint}</div>
    </th>
  );
}
