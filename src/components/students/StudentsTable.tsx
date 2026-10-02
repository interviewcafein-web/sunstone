import { Link } from '@tanstack/react-router';
import { ArrowDown } from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { PlatformLogo } from '@/components/profile/PlatformLogo';
import { Medal } from '@/components/students/Medal';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import type { PlatformSummary } from '@/lib/coding-profiles/summaries';
import type { Platform, PlatformId } from '@/lib/coding-profiles/types';
import type { Student } from '@/lib/students/types';
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
  loading: boolean;
}

interface StudentsTableProps {
  rows: StudentRow[];
  sort: SortKey;
  onSort: (sort: SortKey) => void;
}

export function StudentsTable({ rows, sort, onSort }: StudentsTableProps) {
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);

  return (
    <div className="shadow-card overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[60rem] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs text-slate-600">
            <th scope="col" className="w-10 px-3 py-2.5 font-semibold">
              #
            </th>
            <SortHeader label="Student" sortKey="name" sort={sort} onSort={onSort} />
            {PLATFORMS.map((platform) => (
              <SortHeader
                key={platform.id}
                label={platform.name}
                icon={<PlatformLogo platform={platform.id} />}
                hint={platform.id === 'github' ? 'contributions, 1 yr' : 'solved'}
                sortKey={platform.id}
                sort={sort}
                onSort={onSort}
                numeric
              />
            ))}
            <SortHeader label="Total solved" sortKey="total" sort={sort} onSort={onSort} numeric />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student, cells, total, loading }, index) => (
            <tr
              key={student.id}
              className="animate-rise hover:bg-brand-50/50 border-b border-slate-100 transition-colors last:border-0"
              style={{ animationDelay: `${Math.min(index, 15) * 30}ms` }}
            >
              <td className="px-3 py-3 align-middle text-slate-400 tabular-nums">
                {sort === 'total' && index < 3 && total > 0 ? <Medal place={index} /> : index + 1}
              </td>
              <th scope="row" className="px-3 py-3 text-left align-middle font-normal">
                <div className="flex items-center gap-3">
                  <Avatar name={student.name} />
                  <div className="min-w-0">
                    <Link
                      to="/profile"
                      search={{ ...student.handles, name: student.name }}
                      className="text-brand-700 font-semibold hover:underline"
                    >
                      {student.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {[student.campus, student.course, student.batch].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              </th>
              {PLATFORMS.map((platform) => (
                <td key={platform.id} className="px-3 py-3 text-right align-middle">
                  <PlatformCell platform={platform} cell={cells[platform.id]} />
                </td>
              ))}
              <td className="px-3 py-3 text-right align-middle">
                <span className="text-base font-bold tabular-nums">{total.toLocaleString()}</span>
                <div className="mt-1 ml-auto h-1 w-20 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="from-brand-400 to-brand-700 h-full rounded-full bg-gradient-to-r transition-[width] duration-500"
                    style={{ width: `${(total / maxTotal) * 100}%` }}
                  />
                </div>
                {loading && <div className="mt-0.5 text-xs text-slate-400">loading…</div>}
              </td>
            </tr>
          ))}
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
}

function SortHeader({ label, icon, hint, sortKey, sort, onSort, numeric }: SortHeaderProps) {
  const active = sort === sortKey;

  return (
    <th
      scope="col"
      aria-sort={active ? (sortKey === 'name' ? 'ascending' : 'descending') : undefined}
      className={cn('px-3 py-2.5 font-semibold', numeric && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'hover:text-brand-700 inline-flex items-center gap-1.5',
          active && 'text-brand-700'
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

function PlatformCell({ platform, cell }: { platform: Platform; cell: Cell }) {
  switch (cell.kind) {
    case 'none':
      return <span className="text-slate-300">—</span>;
    case 'invalid':
      return (
        <span
          title={`The sheet entry for ${platform.name} is not a username or a profile link.`}
          className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
        >
          Check entry
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
          title={`No ${platform.name} account named "${cell.handle}".`}
          className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
        >
          Not found
        </span>
      );
    case 'error':
      return (
        <button
          type="button"
          onClick={cell.retry}
          title={cell.message}
          className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Retry
        </button>
      );
    case 'ok':
      return (
        <a
          href={platform.profileUrl(cell.handle)}
          target="_blank"
          rel="noopener noreferrer"
          title={`${cell.handle} on ${platform.name}`}
          className="group inline-block"
        >
          <span className="font-semibold tabular-nums group-hover:underline">
            {cell.summary.value.toLocaleString()}
          </span>
          {cell.summary.detail && platform.id !== 'github' && (
            <div className="text-xs text-slate-500">{cell.summary.detail}</div>
          )}
        </a>
      );
  }
}
