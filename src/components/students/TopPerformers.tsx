import { Link } from '@tanstack/react-router';
import { Crown, Trophy } from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { CountUp } from '@/components/common/CountUp';
import { PlatformLogo } from '@/components/profile/PlatformLogo';
import { Medal } from '@/components/students/Medal';
import type { StudentRow } from '@/components/students/StudentsTable';
import { PLATFORMS, SOLVING_PLATFORM_IDS } from '@/lib/coding-profiles/platforms';
import { cn } from '@/lib/utils';

/** Gold, silver and bronze (fixed hex: the theme's colour scales flip in dark mode). */
const PODIUM = [
  { color: '#f59e0b', soft: '#fde68a', label: 'Champion' },
  { color: '#94a3b8', soft: '#e2e8f0', label: 'Runner-up' },
  { color: '#ea580c', soft: '#fed7aa', label: 'Third' },
];

/** On wide screens the champion stands in the middle, raised: 2nd, 1st, 3rd. */
const PODIUM_ORDER = ['md:order-2', 'md:order-1', 'md:order-3'];

/** The three students with the most problems solved in the current view, as a podium. */
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
        className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-[#f59e0b]/15">
          <Trophy className="size-4 text-[#f59e0b]" aria-hidden />
        </span>
        Top performers
        <span className="text-xs font-medium text-slate-500">· most problems solved</span>
      </h2>
      <ol className="grid gap-4 pt-2 md:grid-cols-3">
        {top.map((row, place) => {
          const medal = PODIUM[place];
          const solved = SOLVING_PLATFORM_IDS.flatMap((id) => {
            const cell = row.cells[id];
            return cell.kind === 'ok' && cell.summary.value > 0
              ? [{ id, value: cell.summary.value }]
              : [];
          }).sort((a, b) => b.value - a.value);
          const sum = solved.reduce((total, item) => total + item.value, 0) || 1;
          const champion = place === 0;

          return (
            <li
              key={row.student.id}
              className={cn('animate-rise min-w-0', PODIUM_ORDER[place])}
              style={{ animationDelay: `${[120, 0, 220][place]}ms` }}
            >
              <Link
                to="/s/$slug"
                params={{ slug: row.student.slug }}
                className={cn(
                  'group shadow-card bg-surface relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1',
                  champion
                    ? 'border-transparent md:-translate-y-2 md:hover:-translate-y-3'
                    : 'border-slate-200'
                )}
                style={
                  champion
                    ? {
                        boxShadow: `0 0 0 2px ${medal.color}, 0 24px 48px -24px ${medal.color}`,
                      }
                    : undefined
                }
              >
                {/* The medal colour washing down from the top. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 -z-10 h-16 opacity-25 transition-opacity duration-300 group-hover:opacity-40"
                  style={{ background: `linear-gradient(180deg, ${medal.soft}, transparent)` }}
                />
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: `linear-gradient(90deg, ${medal.color}, ${medal.soft})` }}
                />
                {champion && <span aria-hidden className="shimmer-sweep absolute inset-0 -z-10" />}

                <div className="flex items-center gap-3 px-4 pt-4">
                  <div className="relative shrink-0">
                    {champion && (
                      <Crown
                        className="absolute -top-3.5 left-1/2 size-5 -translate-x-1/2 -rotate-6 fill-[#fbbf24] text-[#d97706] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-0"
                        aria-hidden
                      />
                    )}
                    <span
                      className="block rounded-full p-0.5"
                      style={{
                        background: `conic-gradient(${medal.color}, ${medal.soft}, ${medal.color})`,
                      }}
                    >
                      <Avatar
                        name={row.student.name}
                        className="size-11 text-sm ring-2 ring-white"
                      />
                    </span>
                    <Medal
                      place={place}
                      className="absolute -right-1.5 -bottom-1 size-5 text-[10px]"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className="rounded-full px-1.5 py-px text-[9px] font-bold tracking-wider uppercase"
                      style={{ background: `${medal.color}22`, color: medal.color }}
                    >
                      {medal.label}
                    </span>
                    <p className="group-hover:text-brand-700 dark:group-hover:text-brand-300 mt-0.5 truncate font-bold text-slate-900">
                      {row.student.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {[row.student.campus, row.student.batch].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <p className="shrink-0 text-right leading-none">
                    <span
                      className={cn(
                        'block font-extrabold tracking-tight tabular-nums',
                        champion ? 'text-3xl' : 'text-2xl'
                      )}
                    >
                      <CountUp value={row.total} />
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">solved</span>
                  </p>
                </div>

                {/* Where the problems were solved: one bar split by platform, then the counts. */}
                <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-3.5">
                  <div className="flex h-1.5 min-w-24 flex-1 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                    {solved.map(({ id, value }) => (
                      <span
                        key={id}
                        title={`${PLATFORMS.find((platform) => platform.id === id)!.name}: ${value.toLocaleString()}`}
                        className="h-full"
                        style={{
                          width: `${(value / sum) * 100}%`,
                          background: PLATFORMS.find((platform) => platform.id === id)!.color,
                        }}
                      />
                    ))}
                  </div>
                  <ul className="flex shrink-0 gap-1">
                    {solved.slice(0, 3).map(({ id, value }) => (
                      <li
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                      >
                        <PlatformLogo platform={id} className="size-3" />
                        {value.toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
