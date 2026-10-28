import { Link } from '@tanstack/react-router';
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  ClipboardCheck,
  Crown,
  Award,
} from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { PlatformLogo } from '@/components/profile/PlatformLogo';
import { Medal } from '@/components/students/Medal';
import { StatusTags } from '@/components/students/StatusTags';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import type { PlatformSummary } from '@/lib/coding-profiles/summaries';
import type { Platform, PlatformId } from '@/lib/coding-profiles/types';
import type { StudentMetrics } from '@/lib/assessments';
import { scoreFill, scoreTone } from '@/lib/assessments';
import type { Student } from '@/lib/students/types';
import { zoneById, type ZoneResult } from '@/lib/students/zones';
import type { SortKey } from '@/routes/index';
import { cn } from '@/lib/utils';

export type Cell =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'loading'; handle: string }
  | { kind: 'not_found'; handle: string }
  | { kind: 'error'; handle: string; message: string; retry: () => void }
  | { kind: 'ok'; handle: string; summary: PlatformSummary };

export interface StudentRow {
  student: Student;
  cells: Record<PlatformId, Cell>;
  /** Problems solved across the platforms that have loaded so far. */
  total: number;
  /** The platform with the most solved problems, and its share of the total. */
  strongest?: { platform: PlatformId; share: number };
  /** Practice zone; null while the platform that decides it is still loading. */
  zone: ZoneResult | null;
  /** Most recent active day across the platforms that report one. */
  lastActive?: { day: string; platform: PlatformId };
  /** Attendance, AMCAT and PRIME tests, from the LMS (absent until loaded or if none). */
  metrics?: StudentMetrics;
  loading: boolean;
}

interface StudentsTableProps {
  rows: StudentRow[];
  sort: SortKey;
  onSort: (sort: SortKey) => void;
}

// Top three rows get a faint medal tint when the table is ranked by total.
const PODIUM_TINT = [
  'bg-amber-50/70 dark:bg-amber-50/20',
  'bg-slate-100/70 dark:bg-slate-100/40',
  'bg-orange-50/60 dark:bg-orange-50/20',
];

// The table shows the platforms most students use; a student's page shows all six, and the
// total and zones still count every platform.
const TABLE_PLATFORMS = PLATFORMS.filter((platform) =>
  ['leetcode', 'geeksforgeeks', 'github'].includes(platform.id)
);

export function StudentsTable({ rows, sort, onSort }: StudentsTableProps) {
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);
  // Best value per platform column in this view: drives the mini bars and the crown.
  const columnMax = Object.fromEntries(
    PLATFORMS.map((platform) => [
      platform.id,
      Math.max(
        0,
        ...rows.map((row) => {
          const cell = row.cells[platform.id];
          return cell.kind === 'ok' ? cell.summary.value : 0;
        })
      ),
    ])
  ) as Record<PlatformId, number>;

  return (
    <div className="shadow-card bg-surface overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-272 text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs text-slate-600">
            <th scope="col" className="w-10 px-3 py-2.5 font-semibold">
              #
            </th>
            <SortHeader label="Student" sortKey="name" sort={sort} onSort={onSort} />
            {TABLE_PLATFORMS.map((platform) => (
              <SortHeader
                key={platform.id}
                label={platform.name}
                icon={<PlatformLogo platform={platform.id} />}
                hint={platform.id === 'github' ? 'contributions, 1 yr' : 'solved'}
                sortKey={platform.id}
                sort={sort}
                onSort={onSort}
                numeric
                divided
              />
            ))}
            <SortHeader
              label="Attendance"
              icon={<CalendarCheck className="size-3.5 text-emerald-600" aria-hidden />}
              hint="classes, PRIME"
              sortKey="attendance"
              sort={sort}
              onSort={onSort}
              numeric
              divided
            />
            <SortHeader
              label="AMCAT"
              icon={<Award className="size-3.5 text-amber-600" aria-hidden />}
              hint="latest, trend"
              sortKey="amcat"
              sort={sort}
              onSort={onSort}
              numeric
              divided
            />
            <SortHeader
              label="PRIME tests"
              icon={<ClipboardCheck className="text-brand-600 size-3.5" aria-hidden />}
              hint="average, taken"
              sortKey="tests"
              sort={sort}
              onSort={onSort}
              numeric
              divided
            />
            <SortHeader
              label="Total solved"
              hint="all platforms"
              sortKey="total"
              sort={sort}
              onSort={onSort}
              numeric
              divided
            />
            <SortHeader
              label="Last active"
              hint="any platform"
              sortKey="active"
              sort={sort}
              onSort={onSort}
              divided
            />
          </tr>
        </thead>
        <tbody>
          {rows.map(
            ({ student, cells, total, strongest, lastActive, zone, loading, metrics }, index) => {
              const podium = sort === 'total' && index < 3 && total > 0;
              return (
                <tr
                  key={student.id}
                  className={cn(
                    'animate-rise hover:bg-brand-50/50 dark:hover:bg-brand-900/30 border-b border-dotted border-slate-300 transition-colors last:border-0',
                    podium && PODIUM_TINT[index]
                  )}
                  style={{ animationDelay: `${Math.min(index, 15) * 30}ms` }}
                >
                  <td className="px-3 py-3 align-middle text-slate-400 tabular-nums">
                    {podium ? <Medal place={index} /> : index + 1}
                  </td>
                  <th scope="row" className="px-3 py-3 text-left align-middle font-normal">
                    <div className="flex items-center gap-3">
                      <Avatar name={student.name} />
                      <div className="min-w-0">
                        <Link
                          to="/s/$slug"
                          params={{ slug: student.slug }}
                          className="text-brand-700 dark:text-brand-300 font-semibold hover:underline"
                        >
                          {student.name}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {[student.campus, student.course, student.batch]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {zone && <ZonePill zone={zone} />}
                          <StatusTags status={student.status} className="mt-1" />
                        </div>
                      </div>
                    </div>
                  </th>
                  {TABLE_PLATFORMS.map((platform) => (
                    <td
                      key={platform.id}
                      className="border-l border-dotted border-slate-200 px-3 py-3 text-right align-middle"
                    >
                      <PlatformCell
                        platform={platform}
                        cell={cells[platform.id]}
                        columnMax={columnMax[platform.id]}
                      />
                    </td>
                  ))}
                  <td className="border-l border-dotted border-slate-200 px-3 py-3 text-right align-middle">
                    <AttendanceCell metrics={metrics} />
                  </td>
                  <td className="border-l border-dotted border-slate-200 px-3 py-3 text-right align-middle">
                    <AmcatCell metrics={metrics} />
                  </td>
                  <td className="border-l border-dotted border-slate-200 px-3 py-3 text-right align-middle">
                    <TestsCell metrics={metrics} />
                  </td>
                  <td className="border-l border-dotted border-slate-200 px-3 py-3 text-right align-middle">
                    <span className="text-base font-bold tabular-nums">
                      {total.toLocaleString()}
                    </span>
                    <div className="mt-1 ml-auto h-1 w-20 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="from-brand-400 to-brand-700 h-full rounded-full bg-linear-to-r transition-[width] duration-500"
                        style={{ width: `${(total / maxTotal) * 100}%` }}
                      />
                    </div>
                    {loading ? (
                      <div className="mt-0.5 text-xs text-slate-400">loading…</div>
                    ) : (
                      strongest && (
                        <div
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500"
                          title="Share of this student's total solved on their strongest platform"
                        >
                          <PlatformLogo platform={strongest.platform} className="size-3" />
                          {strongest.share}% here
                        </div>
                      )
                    )}
                  </td>
                  <td className="border-l border-dotted border-slate-200 px-3 py-3 align-middle">
                    <LastActive value={lastActive} />
                  </td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  sortKey: SortKey;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  numeric?: boolean;
  /** Dotted line on the left, separating this column from the previous one. */
  divided?: boolean;
}

function SortHeader({
  label,
  icon,
  hint,
  sortKey,
  sort,
  onSort,
  numeric,
  divided,
}: SortHeaderProps) {
  const active = sort === sortKey;

  return (
    <th
      scope="col"
      aria-sort={active ? (sortKey === 'name' ? 'ascending' : 'descending') : undefined}
      className={cn(
        'px-3 py-2.5 font-semibold',
        numeric && 'text-right',
        divided && 'border-l border-dotted border-slate-200'
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'hover:text-brand-700 dark:hover:text-brand-300 inline-flex items-center gap-1.5 whitespace-nowrap',
          active && 'text-brand-700 dark:text-brand-300'
        )}
      >
        {icon}
        {label}
        {active && (
          <ArrowDown className={cn('size-3', sortKey === 'name' && 'rotate-180')} aria-hidden />
        )}
      </button>
      {hint && <div className="font-normal text-slate-400">{hint}</div>}
    </th>
  );
}

const pill = 'rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap';

function PlatformCell({
  platform,
  cell,
  columnMax,
}: {
  platform: Platform;
  cell: Cell;
  columnMax: number;
}) {
  switch (cell.kind) {
    case 'none':
      return <span className="text-slate-300">—</span>;
    case 'invalid':
      // Not a usable username in the form: shown like a missing profile, reason on hover.
      return (
        <span
          className="text-slate-300"
          title={`The ${platform.name} entry in the form is not a username`}
        >
          —
        </span>
      );
    case 'loading':
      return (
        <span
          role="status"
          aria-label="Loading"
          className="inline-block h-4 w-10 animate-pulse rounded bg-slate-200"
        />
      );
    case 'not_found':
      return (
        <span
          className="text-slate-300"
          title={`No ${platform.name} account named "${cell.handle}"`}
        >
          —
        </span>
      );
    case 'error':
      return (
        <button
          type="button"
          onClick={cell.retry}
          title={cell.message}
          className={cn(pill, 'border border-slate-300 text-slate-600 hover:bg-slate-50')}
        >
          Retry
        </button>
      );
    case 'ok': {
      const { value, detail } = cell.summary;
      const best = value > 0 && value === columnMax;
      return (
        <a
          href={platform.profileUrl(cell.handle)}
          target="_blank"
          rel="noopener noreferrer"
          title={`${cell.handle} on ${platform.name}${best ? ' · highest in this view' : ''}`}
          className="group inline-flex flex-col items-end"
        >
          <span className="inline-flex items-center gap-1 font-semibold tabular-nums group-hover:underline">
            {best && (
              <Crown className="size-3.5 text-amber-500" aria-label="Highest in this view" />
            )}
            {value.toLocaleString()}
          </span>
          {detail && platform.id !== 'github' && (
            <span className="text-xs whitespace-nowrap text-slate-500">{detail}</span>
          )}
          {/* Compared with the best on this platform in the current view. */}
          <span className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-slate-100">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${columnMax ? Math.max(4, (value / columnMax) * 100) : 0}%`,
                background: platform.color,
              }}
            />
          </span>
        </a>
      );
    }
  }
}

const DAY_MS = 86_400_000;

/** "Today", "Yesterday", "5d ago", "3w ago", "4mo ago", with a dot coloured by freshness. */
function LastActive({ value }: { value?: StudentRow['lastActive'] }) {
  if (!value) {
    return (
      <span
        className="text-xs text-slate-400"
        title="None of this student's linked platforms reports activity dates"
      >
        —
      </span>
    );
  }

  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.max(0, Math.round((today - Date.parse(value.day)) / DAY_MS));
  const label =
    days === 0
      ? 'Today'
      : days === 1
        ? 'Yesterday'
        : days < 14
          ? `${days}d ago`
          : days < 60
            ? `${Math.round(days / 7)}w ago`
            : `${Math.round(days / 30)}mo ago`;
  const tone =
    days <= 1
      ? 'bg-emerald-500'
      : days <= 7
        ? 'bg-sky-500'
        : days <= 30
          ? 'bg-amber-500'
          : 'bg-slate-400';
  const platform = PLATFORMS.find((item) => item.id === value.platform)!;

  return (
    <span
      className="inline-flex items-center gap-2 text-xs font-medium whitespace-nowrap text-slate-700"
      title={`Last activity on ${value.day} (${platform.name})`}
    >
      <span className="relative flex size-2">
        {days <= 1 && (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden',
              tone
            )}
          />
        )}
        <span className={cn('relative inline-flex size-2 rounded-full', tone)} />
      </span>
      {label}
      <PlatformLogo platform={value.platform} className="size-3" />
    </span>
  );
}

/** Small coloured tag under the student's name: which zone, and what decided it. */
function ZonePill({ zone }: { zone: ZoneResult }) {
  const info = zoneById(zone.zone);
  const basis = zone.basis && PLATFORMS.find((platform) => platform.id === zone.basis)!;
  return (
    <span
      className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold"
      style={{ color: info.color, backgroundColor: `${info.color}1a` }}
      title={
        basis
          ? `${info.label}: ${zone.count} solved on ${basis.name}`
          : `${info.label}: no usable username on any problem-solving platform`
      }
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: info.color }} />
      {info.label}
      {basis && (
        <>
          <span className="opacity-60">·</span>
          {zone.count}
          <PlatformLogo platform={basis.id} className="size-2.5" />
        </>
      )}
    </span>
  );
}

const empty = <span className="text-slate-300">—</span>;

const attendanceTone = (pct: number | null | undefined) =>
  pct == null
    ? 'text-slate-400'
    : pct >= 75
      ? 'text-emerald-600 dark:text-emerald-400'
      : pct >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
const attendanceFill = (pct: number) => (pct >= 75 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444');

function MiniBar({ pct, fill }: { pct: number; fill: string }) {
  return (
    <span className="mt-1 ml-auto block h-1 w-16 overflow-hidden rounded-full bg-slate-100">
      <span
        className="block h-full rounded-full transition-[width] duration-700"
        style={{ width: `${Math.max(3, pct)}%`, background: fill }}
      />
    </span>
  );
}

function AttendanceCell({ metrics }: { metrics?: StudentMetrics }) {
  const pct = metrics?.attendance;
  if (pct == null) return empty;
  return (
    <span className="inline-flex flex-col items-end" title="Classes attended since 1 July">
      <span className={cn('text-base font-bold tabular-nums', attendanceTone(pct))}>{pct}%</span>
      {metrics?.prime_attendance != null && (
        <span className="text-xs whitespace-nowrap text-slate-500">
          PRIME {metrics.prime_attendance}%
        </span>
      )}
      <MiniBar pct={pct} fill={attendanceFill(pct)} />
    </span>
  );
}

/** Latest AMCAT average, a sparkline of every sitting, and the change since the previous one. */
function AmcatCell({ metrics }: { metrics?: StudentMetrics }) {
  const sittings = metrics?.amcat ?? [];
  if (!sittings.length) return empty;
  const scores = sittings.map(([, score]) => score);
  const latest = scores[scores.length - 1];
  const change = scores.length > 1 ? latest - scores[scores.length - 2] : null;
  const width = 64;
  const height = 18;
  const points = scores
    .map((score, index) => {
      const x = scores.length === 1 ? width / 2 : (index / (scores.length - 1)) * width;
      return `${x.toFixed(1)},${(height - (score / 100) * height).toFixed(1)}`;
    })
    .join(' ');
  const Trend =
    change === null || change === 0 ? ArrowRight : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="inline-flex flex-col items-end"
      title={sittings.map(([date, score]) => `${date}: ${score}`).join('\n')}
    >
      <span className="inline-flex items-center gap-1">
        <span className={cn('text-base font-bold tabular-nums', scoreTone(latest))}>{latest}</span>
        {change !== null && (
          <span
            className={cn(
              'inline-flex items-center text-[11px] font-semibold tabular-nums',
              change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-600' : 'text-slate-400'
            )}
          >
            <Trend className="size-3" aria-hidden />
            {change > 0 ? `+${change}` : change < 0 ? change : ''}
          </span>
        )}
      </span>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="mt-0.5 overflow-visible"
        aria-hidden
      >
        {scores.length > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke={scoreFill(latest)}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.split(' ').map((point, index) => {
          const [x, y] = point.split(',');
          return index === scores.length - 1 || scores.length === 1 ? (
            <circle key={index} cx={x} cy={y} r={2.5} fill={scoreFill(latest)} />
          ) : null;
        })}
      </svg>
      <span className="text-[11px] whitespace-nowrap text-slate-500">
        {sittings.length} sitting{sittings.length === 1 ? '' : 's'}
      </span>
    </span>
  );
}

function TestsCell({ metrics }: { metrics?: StudentMetrics }) {
  if (!metrics?.released) return empty;
  const taken = Math.round(((metrics.submitted ?? 0) / metrics.released) * 100);
  return (
    <span
      className="inline-flex flex-col items-end"
      title="Prime Domain Coding tests: average score, and tests taken out of released"
    >
      <span className={cn('text-base font-bold tabular-nums', scoreTone(metrics.test_avg))}>
        {metrics.test_avg == null ? '—' : `${metrics.test_avg}%`}
      </span>
      <span className="text-xs whitespace-nowrap text-slate-500">
        {metrics.submitted ?? 0}/{metrics.released} taken
      </span>
      <MiniBar pct={taken} fill={scoreFill(taken)} />
    </span>
  );
}
