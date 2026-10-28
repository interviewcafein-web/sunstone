import type { LucideIcon } from 'lucide-react';
import { Activity, Check, CheckCircle2, Link2, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { CountUp } from '@/components/common/CountUp';
import { cn } from '@/lib/utils';

interface StudentsHeroProps {
  /** e.g. "SAGE University, Indore · 2027", or "All campuses". */
  scope: string;
  students: number;
  totalStudents: number;
  solved: number;
  linked: number;
  /** Students with coding activity in the last 7 days. */
  activeThisWeek: number;
  checkedAt: number;
  /** Platform profiles loaded so far, out of `linked`. */
  settled: number;
  /** Saved numbers on screen that are being refreshed from the platforms right now. */
  refreshing: number;
  onRefresh: () => void;
}

export function StudentsHero({
  scope,
  students,
  totalStudents,
  solved,
  linked,
  activeThisWeek,
  checkedAt,
  settled,
  refreshing,
  onRefresh,
}: StudentsHeroProps) {
  const loading = settled < linked;

  return (
    <section className="hero-glow from-brand-700 via-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7">
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
            {refreshing > 0
              ? `Showing saved stats · syncing ${refreshing} profile${refreshing === 1 ? '' : 's'} in the background`
              : `Up to date · checked ${new Date(checkedAt).toLocaleTimeString()}`}
          </p>
        </div>
        <RefreshButton
          onRefresh={onRefresh}
          loading={loading}
          settled={settled}
          linked={linked}
          refreshing={refreshing}
        />
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
        <HeroStat icon={Activity} label="Active this week" value={activeThisWeek} />
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
        'hover-lift flex flex-col-reverse rounded-xl border p-3 backdrop-blur-sm',
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

interface RefreshButtonProps {
  onRefresh: () => void;
  loading: boolean;
  settled: number;
  linked: number;
  refreshing: number;
}

/**
 * Idle: a white pill with a sheen on hover. Syncing: the pill fills up with striped progress and
 * a ring counts round the icon. Done: a green tick pops in for a moment.
 */
function RefreshButton({ onRefresh, loading, settled, linked, refreshing }: RefreshButtonProps) {
  const syncing = loading || refreshing > 0;

  // Profiles with fresh numbers, out of all linked ones: one count across loading and refreshing.
  const done = Math.max(0, settled - refreshing);
  const total = linked;
  const progress = total ? Math.min(1, done / total) : 0;

  // Show "Up to date" briefly when a sync finishes.
  const [justFinished, setJustFinished] = useState(false);
  const wasSyncing = useRef(syncing);
  useEffect(() => {
    if (wasSyncing.current && !syncing) {
      setJustFinished(true);
      const timer = setTimeout(() => setJustFinished(false), 2200);
      wasSyncing.current = syncing;
      return () => clearTimeout(timer);
    }
    wasSyncing.current = syncing;
  }, [syncing]);

  const gradient = `refresh-${useId().replace(/:/g, '')}`;
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.round(progress * 100);

  // Colours are fixed hex values: the button stays white in both themes, while the
  // theme's amber and slate scales flip in dark mode.
  return (
    <button
      type="button"
      onClick={onRefresh}
      aria-busy={syncing}
      className={cn(
        'group relative isolate inline-flex min-w-48 items-center gap-3 overflow-hidden rounded-xl py-1.5 pr-4 pl-1.5 text-sm font-semibold shadow-lg transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        justFinished && !syncing ? 'bg-[#10b981] text-white' : 'text-brand-800 bg-white',
        !syncing &&
          !justFinished &&
          'sheen hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0'
      )}
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center">
        {syncing ? (
          <>
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="3.5" stroke="#eef2f7" />
              <circle
                cx="18"
                cy="18"
                r={radius}
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke={`url(#${gradient})`}
                className="transition-[stroke-dasharray] duration-500 ease-out"
                strokeDasharray={`${Math.max(progress, 0.04) * circumference} ${circumference}`}
              />
            </svg>
            <span className="text-brand-800 text-[10px] font-bold tabular-nums">{pct}%</span>
          </>
        ) : justFinished ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
            <Check className="animate-pop size-5" strokeWidth={3} aria-hidden />
          </span>
        ) : (
          <span className="bg-brand-50 flex size-8 items-center justify-center rounded-lg">
            <RefreshCw
              className="size-4 transition-transform duration-500 group-hover:rotate-180"
              aria-hidden
            />
          </span>
        )}
      </span>

      <span className="flex flex-col items-start leading-tight">
        {syncing ? (
          <>
            <span className="flex items-center gap-1.5">
              Syncing stats
              <span aria-hidden className="flex gap-0.5">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="loader-dot size-1 rounded-full bg-[#f59e0b]"
                    style={{ animationDelay: `${dot * 0.15}s` }}
                  />
                ))}
              </span>
            </span>
            <span className="text-brand-500 text-[11px] font-medium tabular-nums">
              {total
                ? `${done.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} profiles`
                : 'Starting…'}
            </span>
          </>
        ) : justFinished ? (
          <span className="animate-rise">Up to date</span>
        ) : (
          <span>Refresh stats</span>
        )}
      </span>

      {syncing && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-[#eef2f7]">
          <span
            className="animate-shimmer block h-full rounded-r-full bg-gradient-to-r from-[#fbbf24] via-[#fde68a] to-[#f97316] bg-[length:200%_100%] transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(pct, 3)}%` }}
          />
        </span>
      )}

      <span className="sr-only" role="status">
        {syncing ? `Syncing, ${pct} percent` : justFinished ? 'Stats up to date' : ''}
      </span>
    </button>
  );
}
