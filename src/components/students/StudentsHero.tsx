import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Link2, RefreshCw, TrendingUp, Users } from 'lucide-react';

import { CountUp } from '@/components/common/CountUp';
import { cn } from '@/lib/utils';

interface StudentsHeroProps {
  /** e.g. "SAGE University, Indore · 2027", or "All campuses". */
  scope: string;
  students: number;
  totalStudents: number;
  solved: number;
  linked: number;
  toFix: number;
  checkedAt: number;
  /** Platform profiles loaded so far, out of `linked`. */
  settled: number;
  onRefresh: () => void;
}

export function StudentsHero({
  scope,
  students,
  totalStudents,
  solved,
  linked,
  toFix,
  checkedAt,
  settled,
  onRefresh,
}: StudentsHeroProps) {
  const loading = settled < linked;

  return (
    <section className="from-brand-700 via-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7">
      {/* The Sunstone step mark, as a faint backdrop. */}
      <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-16 opacity-[0.04]">
        <div className="absolute right-10 bottom-36 h-36 w-80 bg-white" />
        <div className="absolute right-52 bottom-0 h-36 w-80 bg-white" />
      </div>
      <div
        aria-hidden
        className="bg-brand-400/30 pointer-events-none absolute -top-24 right-1/4 size-72 rounded-full blur-3xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-brand-200 text-xs font-semibold tracking-[0.2em] uppercase">
            Student leaderboard
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{scope}</h1>
          <p className="text-brand-100 mt-2 inline-flex items-center gap-2 text-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Live from the sheet · checked {new Date(checkedAt).toLocaleTimeString()}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-brand-800 hover:bg-brand-50 inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} aria-hidden />
          Refresh stats
        </button>
      </div>

      <dl className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <HeroStat icon={Users} label="Students" value={students} note={`of ${totalStudents}`} />
        <HeroStat icon={CheckCircle2} label="Problems solved" value={solved} />
        <HeroStat
          icon={TrendingUp}
          label="Average per student"
          value={students ? Math.round(solved / students) : 0}
        />
        <HeroStat icon={Link2} label="Profiles linked" value={linked} />
        <HeroStat
          icon={AlertTriangle}
          label="Entries to fix"
          value={toFix}
          tone={toFix > 0 ? 'warn' : 'default'}
        />
      </dl>

      {loading && (
        <div className="relative mt-5" role="status">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-300 to-white transition-[width] duration-500"
              style={{ width: `${(settled / linked) * 100}%` }}
            />
          </div>
          <p className="text-brand-100 mt-1.5 text-xs">
            Loaded {settled} of {linked} profiles. Totals and ranking update as they arrive.
          </p>
        </div>
      )}
    </section>
  );
}

interface HeroStatProps {
  icon: LucideIcon;
  label: string;
  value: number;
  note?: string;
  tone?: 'default' | 'warn';
}

function HeroStat({ icon: Icon, label, value, note, tone = 'default' }: HeroStatProps) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse rounded-xl border p-3 backdrop-blur-sm',
        tone === 'warn' ? 'border-amber-300/40 bg-amber-400/15' : 'border-white/15 bg-white/10'
      )}
    >
      <dt className="text-brand-100 mt-0.5 flex items-center gap-1.5 text-xs">
        <Icon
          className={cn('size-3.5', tone === 'warn' ? 'text-amber-300' : 'text-brand-200')}
          aria-hidden
        />
        {label}
      </dt>
      <dd className="text-2xl font-bold tabular-nums">
        <CountUp value={value} />
        {note && <span className="text-brand-200 ml-1 text-sm font-medium">{note}</span>}
      </dd>
    </div>
  );
}
