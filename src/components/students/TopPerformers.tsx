import { Link } from '@tanstack/react-router';
import { Trophy } from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { CountUp } from '@/components/common/CountUp';
import { PlatformLogo } from '@/components/profile/PlatformLogo';
import { Medal } from '@/components/students/Medal';
import type { StudentRow } from '@/components/students/StudentsTable';
import { SOLVING_PLATFORM_IDS } from '@/lib/coding-profiles/platforms';
import { cn } from '@/lib/utils';

/** The three students with the most problems solved in the current view. */
export function TopPerformers({ rows }: { rows: StudentRow[] }) {
  const top = [...rows]
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
  if (top.length === 0) return null;

  return (
    <section aria-labelledby="top-performers">
      <h2
        id="top-performers"
        className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700"
      >
        <Trophy className="size-4 text-amber-500" aria-hidden />
        Top performers
      </h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {top.map((row, place) => {
          const best = SOLVING_PLATFORM_IDS.flatMap((id) => {
            const cell = row.cells[id];
            return cell.kind === 'ok' && cell.summary.value > 0
              ? [{ id, value: cell.summary.value }]
              : [];
          })
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);

          return (
            <li key={row.student.id}>
              <Link
                to="/profile"
                search={{ ...row.student.handles, name: row.student.name }}
                className={cn(
                  'group shadow-card relative flex h-full flex-col rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg',
                  place === 0 ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar name={row.student.name} className="size-11 text-sm" />
                    <Medal place={place} className="absolute -right-1.5 -bottom-1.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="group-hover:text-brand-700 truncate font-semibold">
                      {row.student.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {[row.student.campus, row.student.batch].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums">
                  <CountUp value={row.total} />
                  <span className="ml-1.5 text-sm font-medium text-slate-500">solved</span>
                </p>

                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {best.map(({ id, value }) => (
                    <li
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                    >
                      <PlatformLogo platform={id} className="size-3.5" />
                      {value.toLocaleString()}
                    </li>
                  ))}
                </ul>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
