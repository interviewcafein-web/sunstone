import { useMemo } from 'react';
import {
  BookOpenCheck,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  Crown,
  Users,
} from 'lucide-react';

import { AnimatedRing } from '@/components/common/AnimatedRing';
import { CampusLogo } from '@/components/common/CampusLogo';
import { PageLoader } from '@/components/common/PageLoader';
import { Sparkline, TrendDelta } from '@/components/common/Sparkline';
import { useStudents } from '@/hooks/useStudents';
import {
  lmsDate,
  percent,
  scoreFill,
  useCampusOverview,
  useStudentMetrics,
  type CampusOverview,
} from '@/lib/assessments';
import { cn } from '@/lib/utils';

import { Hero, HeroStat, Problem, heroGrid, panel } from '../components/ui';
import { byProgram, mean, toRow, type Row } from '../lib/rows';
import { TRACKS } from '../lib/subjects';
import { Link } from '../nav';

const HEALTH = [
  { min: 75, label: 'On Track', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { min: 50, label: 'Needs Attention', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { min: 0, label: 'At Risk', chip: 'bg-red-50 text-red-700 ring-red-200' },
];

/** Every campus at a glance; each card opens the campus. */
export default function CampusesPage() {
  const overview = useCampusOverview();
  const students = useStudents();
  const metrics = useStudentMetrics();

  // Each campus's students as table rows, for the program split, Super 100 and the averages.
  const rowsByCampus = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const student of students.data?.students ?? []) {
      const row = toRow(student, metrics.data?.students[student.slug]);
      map.set(student.campus, [...(map.get(student.campus) ?? []), row]);
    }
    return map;
  }, [students.data, metrics.data]);

  if (overview.isPending) return <PageLoader variant="cards" label="Loading campuses" />;
  if (overview.isError) {
    return <Problem message={overview.error.message} onRetry={() => overview.refetch()} />;
  }

  const { campuses, syncedAt } = overview.data;
  const active = campuses.filter((campus) => campus.tests > 0);
  const totals = active.reduce(
    (sum, campus) => ({
      tests: sum.tests + campus.tests,
      submissions: sum.submissions + campus.submissions,
      expected: sum.expected + campus.expected,
    }),
    { tests: 0, submissions: 0, expected: 0 }
  );
  const studentCount = campuses.reduce((sum, campus) => sum + campus.students, 0);
  // Campuses with tests first, then by students.
  const ordered = [...campuses].sort(
    (a, b) => Number(b.tests > 0) - Number(a.tests > 0) || b.students - a.students
  );

  return (
    <div className="rise-stagger space-y-5">
      <Hero eyebrow="Campuses" title="Every Campus at a Glance">
        <p className="text-brand-100 relative mt-2 max-w-2xl text-sm">
          PRIME domain and communication and aptitude tests, attendance, exams and AMCAT for each
          campus, from the Sunstone LMS. Open a campus for its full picture.
          {syncedAt && ` Updated ${lmsDate(syncedAt, true)}.`}
        </p>
        <dl className={cn(heroGrid, 'mt-6')}>
          <HeroStat
            icon={Building2}
            label="Campuses with Tests"
            value={active.length}
            note={`of ${campuses.length}`}
          />
          <HeroStat icon={Users} label="Students" value={studentCount} />
          <HeroStat icon={BookOpenCheck} label="Tests Held" value={totals.tests} />
          <HeroStat icon={ClipboardCheck} label="Submissions" value={totals.submissions} />
          <HeroStat
            icon={Users}
            label="Participation"
            value={percent(totals.submissions, totals.expected)}
            suffix="%"
          />
        </dl>
      </Hero>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map((campus) => (
          <CampusCard
            key={campus.id}
            campus={campus}
            rows={rowsByCampus.get(campus.name) ?? []}
            numbersLoaded={Boolean(metrics.data)}
          />
        ))}
      </div>
    </div>
  );
}

function CampusCard({
  campus,
  rows,
  numbersLoaded,
}: {
  campus: CampusOverview;
  rows: Row[];
  numbersLoaded: boolean;
}) {
  const participation = campus.expected ? percent(campus.submissions, campus.expected) : null;
  const domain = numbersLoaded ? mean(rows.map((row) => row.domain)) : null;
  const elq = numbersLoaded ? mean(rows.map((row) => row.elq)) : null;
  const overall = mean([participation, campus.avg_pct, campus.attendance_pct]);
  const health = overall === null ? undefined : HEALTH.find((level) => overall >= level.min);
  const accent = scoreFill(overall);
  const programs = byProgram(rows.map((row) => row.student));
  const super100 = rows.filter((row) => row.super100).length;

  return (
    <Link
      to="/campuses/$id"
      params={{ id: String(campus.id) }}
      className={cn(
        panel,
        'group hover:border-brand-300 relative isolate block overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgb(16_38_70/0.45)]',
        !campus.tests && 'opacity-80'
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}55)` }}
      />
      <span
        aria-hidden
        className="absolute -top-20 -right-16 -z-10 size-48 rounded-full opacity-[0.13] blur-2xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: accent }}
      />

      <div className="p-5">
        <div className="flex items-start gap-3">
          <CampusLogo name={campus.name} logo={campus.logo} className="size-12" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-1 font-semibold text-slate-900" title={campus.name}>
                {campus.name}
              </p>
              <ChevronRight
                className="group-hover:text-brand-600 mt-0.5 size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              {(['BBA', 'MBA'] as const)
                .filter((program) => programs[program])
                .map((program) => (
                  <span
                    key={program}
                    className="bg-brand-500/10 text-brand-800 dark:text-brand-100 rounded-full px-2 py-0.5 font-semibold tabular-nums"
                  >
                    {program} {programs[program]}
                  </span>
                ))}
              {super100 > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#f3d9a4] to-[#e9c27a] px-2 py-0.5 font-bold text-[#3b2a0c] tabular-nums">
                  <Crown className="size-3" aria-hidden />
                  {super100}
                </span>
              )}
              {health && (
                <span
                  className={cn(
                    'ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                    health.chip
                  )}
                >
                  {health.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {campus.tests ? (
          <>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: TRACKS.domain.short, value: domain ?? campus.avg_pct },
                { label: TRACKS.elq.short, value: elq },
                { label: 'Attendance', value: campus.attendance_pct },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col items-center rounded-xl bg-slate-50 px-1 pt-3 pb-2 ring-1 ring-slate-100 transition group-hover:bg-slate-100/70"
                >
                  <AnimatedRing
                    value={value}
                    size={60}
                    color={(shown) => scoreFill(value === null ? null : shown)}
                  />
                  <span className="mt-1.5 text-center text-[11px] leading-tight font-medium text-slate-600">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-brand-500/10 text-brand-700 dark:text-brand-200 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold">
                <BookOpenCheck className="size-3.5" aria-hidden />
                {campus.tests} tests · {participation ?? 0}% taken
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                <CalendarDays className="size-3.5" aria-hidden />
                Last test {lmsDate(campus.last_test_at)}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
            <CircleDashed className="size-4" aria-hidden />
            No PRIME tests released yet
          </p>
        )}

        {(campus.attendance_weeks.length > 1 || campus.test_weeks.length > 1) && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: 'Attendance, Weekly', values: campus.attendance_weeks, icon: CalendarCheck },
              { label: 'Tests, Weekly', values: campus.test_weeks, icon: BookOpenCheck },
            ].map(({ label, values }) => (
              <div key={label} className="rounded-xl border border-slate-200/80 px-3 pt-2 pb-1">
                <p className="flex items-center justify-between gap-1 text-[11px] text-slate-500">
                  <span className="truncate">{label}</span>
                  <TrendDelta values={values} unit="%" />
                </p>
                {values.length > 1 ? (
                  <Sparkline values={values} width={150} height={32} className="mt-1 w-full" />
                ) : (
                  <p className="py-2 text-xs text-slate-400">Not enough weeks yet</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
