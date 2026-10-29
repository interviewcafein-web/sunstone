import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Award,
  BookOpenCheck,
  CalendarCheck,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDashed,
  Folder,
  FolderTree,
  LayoutDashboard,
  NotebookPen,
  ClipboardCheck,
  Search,
  ShieldAlert,
  Target,
  Trophy,
  Users,
  X,
} from 'lucide-react';

import {
  AmcatTab,
  AttendanceTab,
  InsightsPanel,
  attendanceTone,
} from '@/components/assessments/CampusInsights';
import { DeliverySection } from '@/components/assessments/DeliverySection';
import { ExamsTab } from '@/components/assessments/ExamsSection';
import { Avatar } from '@/components/common/Avatar';
import { AnimatedRing } from '@/components/common/AnimatedRing';
import { cohortLabel, cohortYears, parseBatch } from '@/lib/cohorts';
import { PeriodFilter, inPeriod, type PeriodChoice } from '@/components/assessments/PeriodFilter';
import { CampusLogo } from '@/components/common/CampusLogo';
import { PainPoints } from '@/components/insights/PainPoints';
import { useInsightRows } from '@/hooks/useInsightRows';
import { findPainPoints, groupBy, groupStats, type PainPoint } from '@/lib/insights';
import { INTEGRITY_NOTE, integrityOf, type Integrity } from '@/lib/integrity';
import { Sparkline, TrendDelta, lastChange } from '@/components/common/Sparkline';
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  lmsDate,
  percent,
  scoreFill,
  scoreTone,
  useCampusDetail,
  useCampusOverview,
  useStudentMetrics,
  useTestDetail,
  type CampusDetail,
  type CampusOverview,
  type CampusStudentRow,
  type CampusTest,
  type SubjectTest,
  type SyllabusModule,
  type AmcatRound,
  type TestCategory,
  type TestStatus,
} from '@/lib/assessments';
import { useTour } from '@/hooks/useTour';
import { useSession } from '@/lib/session';
import { chartColors, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { InlineLoader, PageLoader } from '@/components/common/PageLoader';

const route = getRouteApi('/campuses');

const heroClass =
  'hero-glow from-brand-700 via-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7';
const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';

function Loading({
  label,
  variant = 'cards',
}: {
  label: string;
  variant?: 'cards' | 'table' | 'plain';
}) {
  return variant === 'plain' ? (
    <InlineLoader label={label.replace(/…$/, '')} />
  ) : (
    <PageLoader variant={variant} label={label.replace(/…$/, '')} />
  );
}

function Problem({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

/** A small ring showing a percentage; it draws itself and counts up when it comes into view. */
function Ring({ value, size = 56 }: { value: number | null; size?: number }) {
  // The arc turns from red through amber to green as it climbs, ending on the score's colour.
  return (
    <AnimatedRing
      value={value}
      size={size}
      color={(shown) => scoreFill(value === null ? null : shown)}
    />
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  note,
  trend,
  percentTrend = true,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  note?: string;
  /** Week by week (oldest first): drawn as a line with the change since last week. */
  trend?: (number | null)[];
  percentTrend?: boolean;
}) {
  const change = trend ? lastChange(trend) : null;
  return (
    <div className="hover-lift relative flex flex-col-reverse overflow-hidden rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
      <dt className="text-brand-100 mt-0.5 flex items-center gap-1.5 text-xs">
        <Icon className="text-brand-200 size-3.5" aria-hidden />
        {label}
        {change !== null && change !== 0 && (
          <span
            className={cn(
              'ml-auto font-semibold',
              change > 0 ? 'text-emerald-300' : 'text-red-300'
            )}
            title="Change since last week"
          >
            {change > 0 ? '▲' : '▼'} {Math.abs(change)}
            {percentTrend ? '%' : ''}
          </span>
        )}
      </dt>
      <dd className="text-2xl font-bold tabular-nums">
        {value}
        {note && <span className="text-brand-200 ml-1 text-sm font-medium">{note}</span>}
      </dd>
      {trend && trend.filter((point) => point !== null).length > 1 && (
        <Sparkline
          values={trend}
          width={200}
          height={30}
          percent={percentTrend}
          stretch
          color="rgb(255 255 255 / 0.9)"
          className="pointer-events-none absolute inset-x-0 bottom-0 opacity-30"
        />
      )}
    </div>
  );
}

/** Campuses: every campus at a glance, then one campus's PRIME journey. */
export default function AssessmentsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const session = useSession().data;
  const overview = useCampusOverview();

  // A campus team with one campus has nothing to choose: open it.
  const onlyCampus = session?.campuses?.length === 1 ? session.campuses[0].id : undefined;
  useEffect(() => {
    if (!search.campus && onlyCampus) {
      navigate({ search: { campus: onlyCampus }, replace: true });
    }
  }, [search.campus, onlyCampus, navigate]);

  if (search.campus) {
    const picked = overview.data?.campuses.find((campus) => campus.id === search.campus);
    return <CampusView campusId={search.campus} name={picked?.name} logo={picked?.logo} />;
  }
  if (overview.isPending) return <Loading label="Loading campuses…" />;
  if (overview.isError) return <Problem message={overview.error.message} />;

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

  return (
    <div className="rise-stagger space-y-5">
      <section className={heroClass}>
        <p className="text-brand-200 text-xs font-semibold tracking-[0.2em] uppercase">Campuses</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Every campus at a glance
        </h1>
        <p className="text-brand-100 mt-2 max-w-2xl text-sm">
          PRIME tests, attendance, exams and AMCAT for each campus, from the Sunstone LMS. Open a
          campus for its full journey.{syncedAt && ` Updated ${lmsDate(syncedAt, true)}.`}
        </p>
        <dl className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <HeroStat
            icon={Building2}
            label="Campuses with tests"
            value={String(active.length)}
            note={`of ${campuses.length}`}
          />
          <HeroStat
            icon={BookOpenCheck}
            label="Tests held"
            value={totals.tests.toLocaleString('en-IN')}
          />
          <HeroStat
            icon={ClipboardCheck}
            label="Submissions"
            value={totals.submissions.toLocaleString('en-IN')}
          />
          <HeroStat
            icon={Users}
            label="Participation"
            value={`${percent(totals.submissions, totals.expected)}%`}
          />
        </dl>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {campuses.map((campus) => (
          <CampusCard key={campus.id} campus={campus} />
        ))}
      </div>
    </div>
  );
}

const HEALTH = [
  { min: 75, label: 'On track', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { min: 50, label: 'Needs attention', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { min: 0, label: 'At risk', chip: 'bg-red-50 text-red-700 ring-red-200' },
];

function CampusCard({ campus }: { campus: CampusOverview }) {
  const participation = campus.expected ? percent(campus.submissions, campus.expected) : null;
  const scores = [participation, campus.avg_pct, campus.attendance_pct].filter(
    (value): value is number => value !== null
  );
  const overall = scores.length
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : null;
  const health = overall === null ? undefined : HEALTH.find((level) => overall >= level.min);
  const accent = scoreFill(overall);
  const inPrime = campus.students ? (campus.in_prime / campus.students) * 100 : 0;

  return (
    <Link
      to="/campuses"
      search={{ campus: campus.id }}
      className={cn(
        panel,
        'group hover:border-brand-300 relative isolate block overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgb(16_38_70/0.45)]',
        !campus.tests && 'opacity-75'
      )}
    >
      {/* Health colour: a strip along the top and a soft glow in the corner. */}
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
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200">
                <span
                  className="bar-fill bg-brand-500 block h-full rounded-full"
                  style={{ width: `${inPrime}%` }}
                />
              </span>
              <span className="truncate text-xs text-slate-500 tabular-nums">
                {campus.in_prime.toLocaleString('en-IN')} of{' '}
                {campus.students.toLocaleString('en-IN')} in PRIME
              </span>
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
                { label: 'Participation', value: participation, icon: Users },
                { label: 'Avg score', value: campus.avg_pct, icon: Target },
                { label: 'Attendance', value: campus.attendance_pct, icon: CalendarCheck },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex flex-col items-center rounded-xl bg-slate-50 px-1 pt-3 pb-2 ring-1 ring-slate-100 transition group-hover:bg-slate-100/70"
                >
                  <Ring value={value} size={60} />
                  <span className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-slate-600">
                    <Icon className="size-3 text-slate-400" aria-hidden />
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-brand-500/10 text-brand-700 dark:text-brand-200 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold">
                <BookOpenCheck className="size-3.5" aria-hidden />
                {campus.tests} tests
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
            No PRIME domain tests released yet
          </p>
        )}

        {(campus.attendance_weeks.length > 1 || campus.test_weeks.length > 1) && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: 'Attendance, weekly', values: campus.attendance_weeks },
              { label: 'Tests, weekly', values: campus.test_weeks },
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

const CATEGORIES: TestCategory[] = ['assignment', 'test', 'mcq', 'amcat_mock'];

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'subject', label: 'Prime Mock Test', icon: Trophy },
  { id: 'modules', label: 'Practice Test and MCQs', icon: FolderTree },
  { id: 'amcat', label: 'AMCAT', icon: Award },
  { id: 'exams', label: 'Exams', icon: NotebookPen },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'students', label: 'Students', icon: Users },
] as const;

const isOut = (test: CampusTest) => test.status === 'completed' || test.status === 'live';

/** A warning that a test's scores look unusually high and uniform (src/lib/integrity.ts). */
function IntegrityBadge({
  integrity,
  compact = false,
}: {
  integrity: Integrity | null;
  compact?: boolean;
}) {
  if (!integrity) return null;
  const high = integrity.level === 'high';
  return (
    <span
      title={`${integrity.reasons.join('. ')}.\n${INTEGRITY_NOTE}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
        high ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-amber-50 text-amber-800 ring-amber-200'
      )}
    >
      <ShieldAlert className="size-3" aria-hidden />
      {compact ? (high ? 'Copying?' : 'Check') : high ? 'Possible copying' : 'Check scores'}
    </span>
  );
}

function StatusChip({ status }: { status: TestStatus }) {
  return (
    <span
      className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold', STATUS_STYLES[status])}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function CategoryChip({ category }: { category: TestCategory }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-px text-[10px] font-semibold',
        CATEGORY_STYLES[category]
      )}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function CampusView({
  campusId,
  name,
  logo,
}: {
  campusId: number;
  name?: string;
  logo?: string | null;
}) {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const detail = useCampusDetail(campusId, search.batch);
  // On narrow screens the tab bar scrolls sideways; keep the open tab in view.
  const tabBar = useRef<HTMLElement>(null);
  const openTab = search.tab ?? 'overview';
  useEffect(() => {
    const bar = tabBar.current;
    const active = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    // Scroll only the bar sideways, never the page.
    if (bar && active) {
      bar.scrollTo({
        left: active.offsetLeft - (bar.clientWidth - active.clientWidth) / 2,
        behavior: 'smooth',
      });
    }
  }, [openTab, detail.data]);
  useTour('campus', Boolean(detail.data));
  const set = (patch: Partial<typeof search>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  const tab = TABS.some((item) => item.id === search.tab) ? search.tab! : 'overview';
  // Year, term and name filters shared by the test tabs (kept in the address).
  const choice: PeriodChoice = { year: search.year, term: search.term, q: search.q };
  const setChoice = (next: PeriodChoice) => set({ year: next.year, term: next.term, q: next.q });

  if (detail.isPending) return <Loading variant="table" label="Loading the campus…" />;
  if (detail.isError) return <Problem message={detail.error.message} />;

  const data = detail.data;
  const { summary, batches, syncedAt } = data;
  const open = (test: CampusTest) => isOut(test) && set({ test: test.ids.join(',') });

  return (
    <div className="rise-stagger space-y-5">
      <section className={heroClass}>
        <nav aria-label="Breadcrumb" className="text-brand-100 flex items-center gap-1.5 text-sm">
          <Link to="/campuses" className="hover:text-white hover:underline">
            Campuses
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span className="font-medium text-white">{name ?? 'Campus'}</span>
        </nav>
        <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {name && <CampusLogo name={name} logo={logo} className="size-12 sm:size-14" />}
          {name ?? 'Campus'}
        </h1>
        <p className="text-brand-100 mt-1 text-sm">
          PRIME domain journey ·{' '}
          {data.subjects.map((subject) => subject.name).join(', ') || 'Prime Domain Coding'}
          {syncedAt && ` · updated ${lmsDate(syncedAt, true)}`}
        </p>

        {batches.length > 1 && (
          <BatchPicker
            batches={batches}
            value={search.batch}
            onChange={(batch) => set({ batch, test: undefined })}
          />
        )}

        <dl
          className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-5"
          data-tour="campus-tiles"
        >
          <HeroStat
            icon={BookOpenCheck}
            label="Tests held"
            value={String(summary.tests)}
            note={summary.scheduled ? `+${summary.scheduled} scheduled` : undefined}
            trend={data.timeline.map((week) => week.tests)}
            percentTrend={false}
          />
          <HeroStat
            icon={Users}
            label="Participation"
            value={`${percent(summary.submissions, summary.expected)}%`}
            note={`${summary.submissions.toLocaleString('en-IN')} subs`}
            trend={data.timeline.map((week) => week.participation)}
          />
          <HeroStat
            icon={Target}
            label="Average score"
            value={summary.avg_pct === null ? '—' : `${summary.avg_pct}%`}
            trend={data.timeline.map((week) => week.avg_pct)}
          />
          <HeroStat
            icon={CalendarCheck}
            label="Attendance"
            value={data.attendance.pct === null ? '—' : `${data.attendance.pct}%`}
            note={
              data.attendance.prime_pct === null ? undefined : `PRIME ${data.attendance.prime_pct}%`
            }
            trend={data.attendance.weeks.slice(-10).map((week) => week.pct)}
          />
          <HeroStat
            icon={CalendarDays}
            label="Learning & Practice started"
            value={`${percent(summary.modules_started, summary.modules)}%`}
            note={`${summary.modules_started}/${summary.modules} modules`}
          />
        </dl>
      </section>

      <nav
        ref={tabBar}
        aria-label="Campus sections"
        data-tour="campus-tabs"
        className="relative flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-none"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => set({ tab: id === 'overview' ? undefined : id })}
            aria-current={tab === id ? 'page' : undefined}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition',
              tab === id
                ? 'border-brand-700 text-brand-700 dark:text-brand-300'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {id === 'subject' && <Count n={data.subjectTests.length} />}
            {id === 'students' && <Count n={data.students.length} />}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          {name && <CampusPainPoints campus={name} batch={search.batch} tests={allTests(data)} />}
          <OverviewTab data={data} onOpen={open} onTab={(id) => set({ tab: id })} />
        </>
      )}
      {tab === 'subject' && (
        <SubjectTestsTab
          tests={data.subjectTests}
          onOpen={open}
          choice={choice}
          onChoice={setChoice}
        />
      )}
      {tab === 'modules' && (
        <ModulesTab
          data={data}
          onOpen={open}
          type={search.type}
          onType={(type) => set({ type })}
          choice={choice}
          onChoice={setChoice}
        />
      )}
      {tab === 'exams' && <ExamsTab data={data.exams} />}
      {tab === 'attendance' && <AttendanceTab data={data.attendance} />}
      {tab === 'amcat' && <AmcatTab data={data.amcat} choice={choice} onChoice={setChoice} />}
      {tab === 'students' && (
        <StudentsTab
          students={data.students}
          mocks={data.subjectTests}
          rounds={data.amcat.rounds}
        />
      )}

      {search.test && (
        <TestPanel
          campusId={campusId}
          batch={search.batch}
          test={search.test}
          onClose={() => set({ test: undefined })}
        />
      )}
    </div>
  );
}

/**
 * This campus's (and batch's) pain points, from the same 360° model as the 360° page: its
 * students on all five fronts, with the batches compared when no batch is chosen.
 */
function CampusPainPoints({
  campus,
  batch,
  tests,
}: {
  campus: string;
  /** "2025" or a cohort "BCA:2025". */
  batch?: string;
  /** The campus's tests, for unusual-score flags. */
  tests: CampusTest[];
}) {
  const { rows, isPending } = useInsightRows();
  const cohort = parseBatch(batch);
  const { points, scope } = useMemo(() => {
    const scoped = rows.filter(
      (row) =>
        row.student.campus === campus &&
        (!cohort.year || row.student.batch === cohort.year) &&
        (!cohort.program || row.student.course === cohort.program)
    );
    const stats = groupStats(campus, scoped);
    const groups = batch
      ? []
      : groupBy(scoped, (row) => row.student.batch).filter((group) => group.students >= 5);
    const flagged = tests.filter((test) => test.integrity);
    const integrity: PainPoint[] = flagged.length
      ? [
          {
            severity: flagged.some((test) => test.integrity!.level === 'high') ? 'high' : 'medium',
            dimension: 'tests',
            title: `${flagged.length} test${flagged.length === 1 ? ' has' : 's have'} unusually high scores`,
            detail: `Possible copying in the open browser: ${flagged
              .slice(0, 3)
              .map((test) => test.name)
              .join(
                ', '
              )}${flagged.length > 3 ? ` and ${flagged.length - 3} more` : ''}. Look for the badge on the test.`,
            weight: 70 + flagged.length * 5,
          },
        ]
      : [];
    const points = [...findPainPoints(stats, groups, 'batches'), ...integrity].sort(
      (a, b) => b.weight - a.weight
    );
    return { points, scope: stats };
  }, [rows, campus, batch, tests, cohort.year, cohort.program]);

  if (isPending) return <InlineLoader label="Finding pain points…" />;
  if (!scope.students) return null;
  return (
    <PainPoints
      points={points}
      columns={2}
      limit={4}
      action={
        <Link
          to="/insights"
          search={{ campus, batch: cohort.year }}
          className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
        >
          Full 360° view
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      }
    />
  );
}

const pillClass = (on: boolean) =>
  cn(
    'rounded-full px-3 py-1 text-xs font-semibold transition',
    on ? 'text-brand-800 bg-white' : 'bg-white/10 text-white hover:bg-white/20'
  );

/**
 * Batches in two steps: the programs first (All batches, B.Tech, BCA…), then that program's
 * years (All years, 2025–29…) once one is picked. Values: "B.Tech:" or "B.Tech:2025".
 */
function BatchPicker({
  batches,
  value,
  onChange,
}: {
  batches: CampusDetail['batches'];
  value?: string;
  onChange: (batch: string | undefined) => void;
}) {
  const { program } = parseBatch(value);
  const programs = [...new Set(batches.map((batch) => batch.program))].map((name) => ({
    name,
    students: batches
      .filter((batch) => batch.program === name)
      .reduce((sum, batch) => sum + batch.students, 0),
  }));
  const cohorts = batches.filter((batch) => batch.program === program);
  return (
    <div className="mt-4 space-y-2" data-tour="campus-batches">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Program">
        <button type="button" onClick={() => onChange(undefined)} className={pillClass(!value)}>
          All batches
        </button>
        {programs.map(({ name, students }) => (
          <button
            key={name}
            type="button"
            title={`${students} students`}
            onClick={() => onChange(`${name}:`)}
            className={pillClass(program === name)}
          >
            {name}
          </button>
        ))}
      </div>
      {program && cohorts.length > 1 && (
        <div
          className="animate-rise flex flex-wrap items-center gap-1.5 border-l-2 border-white/25 pl-3"
          role="group"
          aria-label={`${program} batches`}
        >
          <button
            type="button"
            onClick={() => onChange(`${program}:`)}
            className={pillClass(value === `${program}:`)}
          >
            All years
          </button>
          {cohorts.map((batch) => (
            <button
              key={batch.key}
              type="button"
              title={`${batch.program} admitted ${batch.year} · ${batch.students} students`}
              onClick={() => onChange(batch.key)}
              className={pillClass(value === batch.key)}
            >
              {cohortYears(batch.program, batch.year)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NothingInPeriod() {
  return (
    <p className={cn(panel, 'p-5 text-sm text-slate-500')}>
      Nothing in this period. Pick another year or term, or clear the filter.
    </p>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600 tabular-nums">
      {n}
    </span>
  );
}

/** The modules of a subject as a grid: the first three rows, the rest behind "Show all". */
function ModuleGrid({ modules }: { modules: SyllabusModule[] }) {
  const [all, setAll] = useState(false);
  const FIRST = 9;
  const shown = all ? modules : modules.slice(0, FIRST);
  return (
    <>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((module, index) => {
          const share = percent(module.released, module.total);
          const state = !module.total
            ? 'empty'
            : module.released === module.total
              ? 'done'
              : module.started
                ? 'progress'
                : 'upcoming';
          return (
            <li key={module.name} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    state === 'done' && 'bg-emerald-500 text-white',
                    state === 'progress' && 'bg-brand-700 text-white',
                    (state === 'upcoming' || state === 'empty') && 'bg-slate-100 text-slate-500'
                  )}
                >
                  {state === 'done' ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" title={module.name}>
                    {module.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {module.total
                      ? `${module.released} of ${module.total} tests released`
                      : 'No tests yet'}
                    {module.folders.length ? ` · ${module.folders.length} topics` : ''}
                  </p>
                  {module.total > 0 && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          'bar-fill h-full rounded-full',
                          state === 'done' ? 'bg-emerald-500' : 'bg-brand-600'
                        )}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {modules.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="text-brand-700 dark:text-brand-300 mt-3 text-sm font-semibold hover:underline"
        >
          {all ? 'Show fewer' : `Show all ${modules.length} modules`}
        </button>
      )}
    </>
  );
}

/** Every test as one list, for the overview's "up next" and the module filter counts. */
const allTests = (data: CampusDetail): CampusTest[] => [
  ...data.subjectTests,
  ...data.subjects.flatMap((subject) =>
    subject.modules.flatMap((module) => [
      ...module.tests,
      ...module.folders.flatMap((folder) => folder.tests),
    ])
  ),
];

function OverviewTab({
  data,
  onOpen,
  onTab,
}: {
  data: CampusDetail;
  onOpen: (test: CampusTest) => void;
  onTab: (tab: string) => void;
}) {
  const colors = chartColors(useTheme());
  const tests = allTests(data);
  const live = tests.filter((test) => test.status === 'live');
  const scheduled = tests
    .filter((test) => test.status === 'scheduled')
    .sort((a, b) => (a.released_at ?? '').localeCompare(b.released_at ?? ''));
  const recent = tests
    .filter((test) => test.status === 'completed')
    .sort((a, b) => (b.released_at ?? '').localeCompare(a.released_at ?? ''))
    .slice(0, 5);
  const timeline = data.timeline.map((week) => ({
    ...week,
    label: lmsDate(week.week).replace(/ \d{4}$/, ''),
  }));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-3">
      <section className={cn(panel, 'p-5 lg:col-span-2')}>
        <h2 className="text-lg font-bold">Journey</h2>
        <p className="text-sm text-slate-500">
          Tests released each week, and how the class scored.
        </p>
        {timeline.length ? (
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeline} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: colors.tick }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="tests"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: colors.tick }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: colors.tick }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: colors.cursor }}
                  contentStyle={{
                    background: colors.tooltip,
                    border: `1px solid ${colors.grid}`,
                    borderRadius: 12,
                    color: colors.text,
                    fontSize: 12,
                  }}
                  labelFormatter={(label) => `Week of ${label}`}
                  formatter={(value, key) =>
                    key === 'tests' ? [value, 'Tests released'] : [`${value}%`, 'Average score']
                  }
                />
                <Bar
                  yAxisId="tests"
                  dataKey="tests"
                  fill="#93c5fd"
                  radius={[6, 6, 0, 0]}
                  animationDuration={900}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="avg_pct"
                  stroke="#1a3e70"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  animationDuration={900}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No tests released yet.</p>
        )}
      </section>

      <section className={cn(panel, 'p-5')}>
        <h2 className="text-lg font-bold">Up next</h2>
        <ul className="mt-3 space-y-2">
          {[...live, ...scheduled].slice(0, 8).map((test) => (
            <li key={test.ids.join(',')}>
              <button
                type="button"
                onClick={() => onOpen(test)}
                disabled={!isOut(test)}
                className="flex w-full items-start justify-between gap-2 rounded-xl border border-slate-200 p-3 text-left transition enabled:hover:border-brand-300"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{test.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {test.lecture ?? test.module ?? test.subject}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                  <StatusChip status={test.status} />
                  <IntegrityBadge integrity={test.integrity} compact />
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {test.status === 'live'
                      ? `Due ${lmsDate(test.due_at)}`
                      : lmsDate(test.released_at)}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!live.length && !scheduled.length && (
            <li className="text-sm text-slate-500">Nothing live or scheduled right now.</li>
          )}
        </ul>
        {recent.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-semibold text-slate-600">Recently completed</h3>
            <ul className="mt-2 space-y-1.5">
              {recent.map((test) => (
                <li key={test.ids.join(',')}>
                  <button
                    type="button"
                    onClick={() => onOpen(test)}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm hover:underline"
                  >
                    <span className="truncate">{test.name}</span>
                    <span
                      className={cn('shrink-0 font-semibold tabular-nums', scoreTone(test.avg_pct))}
                    >
                      {test.avg_pct === null ? '—' : `${test.avg_pct}%`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={cn(panel, 'p-5 lg:col-span-3')}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Learning &amp; Practice</h2>
            <p className="text-sm text-slate-500">
              Each module of the PRIME domain subject: tests released out of all its tests.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onTab('modules')}
            className="text-brand-700 dark:text-brand-300 text-sm font-semibold hover:underline"
          >
            Open Practice Test and MCQs →
          </button>
        </div>
        {data.subjects.map((subject) => (
          <div key={subject.key} className="mt-4">
            {data.subjects.length > 1 && <p className="mb-2 font-semibold">{subject.name}</p>}
            <ModuleGrid modules={subject.modules} />
          </div>
        ))}
      </section>

      <DeliverySection data={data.delivery} />
    </div>
  );
}

const PODIUM = [
  'bg-amber-400 text-amber-950',
  'bg-slate-300 text-slate-800',
  'bg-orange-300 text-orange-950',
];

function SubjectTestsTab({
  tests,
  onOpen,
  choice,
  onChoice,
}: {
  tests: SubjectTest[];
  onOpen: (test: CampusTest) => void;
  choice: PeriodChoice;
  onChoice: (next: PeriodChoice) => void;
}) {
  const order: TestStatus[] = ['live', 'completed', 'scheduled', 'unscheduled'];
  const sorted = tests
    .filter((test) => inPeriod(test.released_at, test.name, choice))
    .sort(
      (a, b) =>
        order.indexOf(a.status) - order.indexOf(b.status) ||
        (b.released_at ?? '').localeCompare(a.released_at ?? '') ||
        a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  if (!tests.length) {
    return (
      <p className={cn(panel, 'p-5 text-sm text-slate-500')}>
        No Prime Mock Tests (such as AMCAT mocks) for this campus yet.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <PeriodFilter
        dates={tests.map((test) => test.released_at)}
        choice={choice}
        onChange={onChoice}
        shown={sorted.length}
        total={tests.length}
      />
      {!sorted.length && <NothingInPeriod />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((test) => {
          const out = isOut(test);
          const participation = percent(test.submitted, test.eligible);
          return (
            <article
              key={test.ids.join(',')}
              className={cn(
                panel,
                'flex flex-col p-5',
                out
                  ? 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg'
                  : 'opacity-80'
              )}
              onClick={() => onOpen(test)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-bold">{test.name}</h3>
                  <p className="text-xs text-slate-500">
                    {test.max_marks ? `${Number(test.max_marks)} marks` : ''}
                    {test.minutes ? ` · ${test.minutes} min` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusChip status={test.status} />
                  <IntegrityBadge integrity={test.integrity} />
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                <CalendarDays className="size-3.5 text-slate-400" aria-hidden />
                {test.status === 'unscheduled'
                  ? 'Created, not scheduled for this campus yet'
                  : test.status === 'scheduled'
                    ? `Opens ${lmsDate(test.released_at, true)}`
                    : `Released ${lmsDate(test.released_at)}${test.due_at ? ` · due ${lmsDate(test.due_at)}` : ''}`}
              </p>
              {test.last_release_at && test.last_release_at !== test.released_at && out && (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  More sections from {lmsDate(test.last_release_at)}
                </p>
              )}

              {out && (
                <>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <Ring value={participation} size={52} />
                      <span className="mt-1 text-[10px] text-slate-500">
                        {test.submitted}/{test.eligible} took it
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <Ring value={test.avg_pct} size={52} />
                      <span className="mt-1 text-[10px] text-slate-500">Average</span>
                    </div>
                  </div>
                  {test.leaders.length > 0 && (
                    <ol className="mt-4 space-y-1.5 border-t border-dotted border-slate-200 pt-3">
                      {test.leaders.map((leader, index) => (
                        <li key={leader.username} className="flex items-center gap-2 text-sm">
                          <span
                            className={cn(
                              'inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold',
                              PODIUM[index]
                            )}
                          >
                            {index + 1}
                          </span>
                          <Link
                            to="/s/$slug"
                            params={{ slug: leader.username }}
                            onClick={(event) => event.stopPropagation()}
                            className="min-w-0 flex-1 truncate font-medium hover:underline"
                          >
                            {leader.name}
                          </Link>
                          <span className={cn('font-bold tabular-nums', scoreTone(leader.pct))}>
                            {leader.pct}%
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="text-brand-700 dark:text-brand-300 mt-auto pt-3 text-xs font-semibold">
                    Full leaderboard →
                  </p>
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ModulesTab({
  data,
  onOpen,
  type,
  onType,
  choice,
  onChoice,
}: {
  data: CampusDetail;
  onOpen: (test: CampusTest) => void;
  type?: string;
  onType: (type: string | undefined) => void;
  choice: PeriodChoice;
  onChoice: (next: PeriodChoice) => void;
}) {
  const moduleTests = data.subjects.flatMap((subject) =>
    subject.modules.flatMap((module) => [
      ...module.tests,
      ...module.folders.flatMap((folder) => folder.tests),
    ])
  );
  // The period filter narrows the list first; the type chips count what is left.
  const inChoice = (test: CampusTest) => inPeriod(test.released_at, test.name, choice);
  const periodTests = moduleTests.filter(inChoice);
  const keep = (test: CampusTest) => inChoice(test) && (!type || test.category === type);
  const counts = CATEGORIES.map((category) => ({
    category,
    count: periodTests.filter((test) => test.category === category).length,
  }));
  const shown = periodTests.filter(keep).length;

  return (
    <div className="space-y-3">
      <PeriodFilter
        dates={moduleTests.map((test) => test.released_at)}
        choice={choice}
        onChange={onChoice}
        shown={shown}
        total={moduleTests.length}
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Test type">
        <FilterChip active={!type} onClick={() => onType(undefined)}>
          All · {periodTests.length}
        </FilterChip>
        {counts
          .filter(({ count }) => count > 0)
          .map(({ category, count }) => (
            <FilterChip key={category} active={type === category} onClick={() => onType(category)}>
              {CATEGORY_LABELS[category]} · {count}
            </FilterChip>
          ))}
      </div>
      {!shown && <NothingInPeriod />}
      {data.subjects.map((subject) =>
        subject.modules
          .filter((module) => module.total > 0)
          .map((module) => {
            const tests = module.tests.filter(keep);
            const folders = module.folders
              .map((folder) => ({ ...folder, tests: folder.tests.filter(keep) }))
              .filter((folder) => folder.tests.length);
            if (!tests.length && !folders.length) return null;
            const out = [...tests, ...folders.flatMap((folder) => folder.tests)].filter(isOut);
            const submitted = out.reduce((sum, test) => sum + test.submitted, 0);
            const average = submitted
              ? Math.round(
                  out.reduce((sum, test) => sum + (test.avg_pct ?? 0) * test.submitted, 0) /
                    submitted
                )
              : null;
            return (
              <details
                key={`${subject.key}:${module.name}`}
                open={module.started || Boolean(choice.year || choice.term || choice.q)}
                className={cn(panel, 'group overflow-hidden')}
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
                  <ChevronRight
                    className="size-4 text-slate-400 transition group-open:rotate-90"
                    aria-hidden
                  />
                  <FolderTree className="text-brand-700 dark:text-brand-300 size-4" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{module.name}</span>
                    <span className="block text-xs text-slate-500">
                      {module.released} of {module.total} tests released
                      {module.folders.length ? ` · ${module.folders.length} topics` : ''}
                    </span>
                  </span>
                  <span className={cn('text-sm font-bold tabular-nums', scoreTone(average))}>
                    {average === null ? '' : `${average}% avg`}
                  </span>
                </summary>
                <div className="border-t border-slate-200">
                  {tests.length > 0 && <TestTable tests={tests} onOpen={onOpen} />}
                  {folders.map((folder) => (
                    <div key={folder.title}>
                      <p className="flex items-center gap-2 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-600">
                        <Folder className="size-3.5" aria-hidden />
                        {folder.title}
                      </p>
                      <TestTable tests={folder.tests} onOpen={onOpen} />
                    </div>
                  ))}
                </div>
              </details>
            );
          })
      )}
    </div>
  );
}

function TestTable({ tests, onOpen }: { tests: CampusTest[]; onOpen: (test: CampusTest) => void }) {
  const sorted = [...tests].sort((a, b) =>
    (b.released_at ?? '').localeCompare(a.released_at ?? '')
  );
  return (
    <table className="w-full text-sm">
      <tbody>
        {sorted.map((test) => (
          <TestRow key={test.ids.join(',')} test={test} onOpen={() => onOpen(test)} />
        ))}
      </tbody>
    </table>
  );
}

function TestRow({ test, onOpen }: { test: CampusTest; onOpen: () => void }) {
  const out = isOut(test);
  const participation = percent(test.submitted, test.eligible);
  return (
    <tr
      onClick={out ? onOpen : undefined}
      className={cn(
        'border-b border-dotted border-slate-200 last:border-0',
        out && 'hover:bg-brand-50/50 dark:hover:bg-brand-900/30 cursor-pointer'
      )}
    >
      <td className="px-5 py-2.5">
        <p className={cn('font-medium', out && 'text-brand-700 dark:text-brand-300')}>
          {test.name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <CategoryChip category={test.category} />
          <StatusChip status={test.status} />
          <IntegrityBadge integrity={test.integrity} />
          {test.max_marks && <span>{Number(test.max_marks)} marks</span>}
        </p>
      </td>
      <td className="w-32 px-3 py-2.5 text-xs whitespace-nowrap text-slate-600">
        {test.status === 'unscheduled' ? '—' : lmsDate(test.released_at)}
      </td>
      <td className="w-40 px-3 py-2.5">
        {out && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${participation}%`, backgroundColor: scoreFill(participation) }}
              />
            </div>
            <span className="text-xs whitespace-nowrap text-slate-600 tabular-nums">
              {test.submitted}/{test.eligible}
            </span>
          </div>
        )}
      </td>
      <td
        className={cn(
          'w-20 px-5 py-2.5 text-right font-bold tabular-nums',
          scoreTone(test.avg_pct)
        )}
      >
        {out && test.avg_pct !== null ? `${test.avg_pct}%` : ''}
      </td>
    </tr>
  );
}

function StudentsTab({
  students,
  mocks,
  rounds,
}: {
  students: CampusStudentRow[];
  /** Prime Mock Tests, for one column each. */
  mocks: SubjectTest[];
  /** AMCAT rounds, for one column each. */
  rounds: AmcatRound[];
}) {
  // Week-by-week attendance and per-test scores, for the trend lines.
  const trends = useStudentMetrics().data?.students;
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  // Oldest first, so Mock Test 1 comes before Mock Test 2.
  const mockColumns = mocks
    .filter(isOut)
    .sort((a, b) => (a.released_at ?? '').localeCompare(b.released_at ?? ''));
  const roundColumns = [...rounds].sort((a, b) =>
    (a.first_at ?? '').localeCompare(b.first_at ?? '')
  );

  const rows = students
    .filter((student) => !needle || student.name.toLowerCase().includes(needle))
    .map((student) => {
      const taken = mockColumns
        .map((test) => student.mocks[test.ids.join(',')])
        .filter((result) => result?.submitted && result.pct !== null);
      const scores = roundColumns
        .map((round) => student.amcat_rounds[round.test_name]?.score)
        .filter((score): score is number => typeof score === 'number');
      return {
        student,
        mockTaken: taken.length,
        mockAssigned: mockColumns.filter((test) => student.mocks[test.ids.join(',')]).length,
        mockAvg: taken.length
          ? Math.round(taken.reduce((sum, result) => sum + result!.pct!, 0) / taken.length)
          : null,
        amcatRounds: scores.length,
        amcatAvg: scores.length
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : null,
      };
    })
    .sort(
      (a, b) =>
        (b.mockAvg ?? -1) - (a.mockAvg ?? -1) ||
        (b.student.avg_pct ?? -1) - (a.student.avg_pct ?? -1) ||
        a.student.name.localeCompare(b.student.name)
    );

  const head = 'px-3 py-2 font-medium whitespace-nowrap';
  const group = 'border-l border-slate-200';
  const sticky = 'bg-surface sticky left-0 z-10';
  const amcatTone = (score: number | null | undefined) =>
    score == null
      ? 'text-slate-400'
      : score >= 60
        ? 'text-emerald-600 dark:text-emerald-400'
        : score >= 40
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-5">
      <InsightsPanel students={students} />
      <section className={cn(panel, 'overflow-hidden')}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-lg font-bold">Students</h2>
            <p className="text-sm text-slate-500">
              Every Prime Mock Test and AMCAT round, one column each, best mock average first.
              Scroll sideways for more; open a student for their full journey.
            </p>
          </div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
              aria-label="Search students"
              className="focus-visible:outline-brand-500 bg-surface w-56 rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus-visible:outline-2"
            />
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr className="border-t border-slate-200 bg-slate-50/80 text-[10px] font-semibold tracking-wide uppercase">
                <th colSpan={2} className={cn(sticky, 'bg-slate-50 px-5 py-1.5')} />
                <th
                  colSpan={mockColumns.length + 1}
                  className={cn(group, 'text-brand-700 dark:text-brand-300 px-3 py-1.5')}
                >
                  Prime Mock Tests
                </th>
                <th
                  colSpan={roundColumns.length + 1}
                  className={cn(group, 'px-3 py-1.5 text-[#7c3aed]')}
                >
                  AMCAT
                </th>
                <th colSpan={4} className={cn(group, 'px-3 py-1.5')}>
                  Attendance and exams
                </th>
              </tr>
              <tr className="border-y border-slate-200">
                <th className={cn(sticky, 'w-10 px-5 py-2 font-medium')}>#</th>
                <th className={cn(sticky, 'left-10 px-3 py-2 font-medium')}>Student</th>
                <th className={cn(head, group, 'text-right')}>Total</th>
                {mockColumns.map((test) => (
                  <th key={test.ids.join(',')} className={cn(head, 'text-right')}>
                    <span className="block max-w-36 truncate text-slate-700" title={test.name}>
                      {test.name}
                    </span>
                    <span className="block text-[10px] font-normal">
                      {lmsDate(test.released_at)}
                    </span>
                  </th>
                ))}
                <th className={cn(head, group, 'text-right')}>Total</th>
                {roundColumns.map((round) => (
                  <th key={round.test_name} className={cn(head, 'text-right')}>
                    <span
                      className="block max-w-36 truncate text-slate-700"
                      title={round.test_name}
                    >
                      {round.test_name}
                    </span>
                    <span className="block text-[10px] font-normal">{lmsDate(round.first_at)}</span>
                  </th>
                ))}
                <th className={cn(head, group, 'text-right')}>Attendance</th>
                <th className={cn(head, 'text-right')}>Exams avg</th>
                <th className={cn(head, 'text-right')}>All PRIME tests</th>
                <th className={cn(head, 'pr-5')}>Last submission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ({ student, mockTaken, mockAssigned, mockAvg, amcatRounds, amcatAvg }, index) => (
                  <tr
                    key={student.username}
                    className={cn(
                      'group/row border-b border-dotted border-slate-200 last:border-0',
                      index % 2 === 1 && 'bg-slate-50/50'
                    )}
                  >
                    <td className={cn(sticky, 'px-5 py-2.5 text-xs text-slate-400 tabular-nums')}>
                      {index + 1}
                    </td>
                    <td className={cn(sticky, 'left-10 px-3 py-2.5')}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={student.name} className="size-8" />
                        <div className="min-w-0">
                          <Link
                            to="/s/$slug"
                            params={{ slug: student.username }}
                            className="text-brand-700 dark:text-brand-300 block max-w-44 truncate font-semibold hover:underline"
                          >
                            {student.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {cohortLabel(student.program, student.admission_year)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className={cn(group, 'px-3 py-2.5 text-right whitespace-nowrap')}>
                      <span className={cn('font-bold tabular-nums', scoreTone(mockAvg))}>
                        {mockAvg === null ? '—' : `${mockAvg}%`}
                      </span>
                      <span className="block text-[11px] text-slate-500 tabular-nums">
                        {mockTaken}/{mockAssigned} taken
                      </span>
                    </td>
                    {mockColumns.map((test) => {
                      const result = student.mocks[test.ids.join(',')];
                      return (
                        <td
                          key={test.ids.join(',')}
                          className="px-3 py-2.5 text-right whitespace-nowrap"
                        >
                          {!result ? (
                            <span className="text-slate-300">—</span>
                          ) : !result.submitted ? (
                            <span className="text-xs font-medium text-slate-400">Absent</span>
                          ) : (
                            <>
                              <span
                                className={cn('font-semibold tabular-nums', scoreTone(result.pct))}
                              >
                                {result.pct}%
                              </span>
                              {result.marks !== null && test.max_marks && (
                                <span className="block text-[11px] text-slate-500 tabular-nums">
                                  {Number(result.marks)}/{Number(test.max_marks)}
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}

                    <td className={cn(group, 'px-3 py-2.5 text-right whitespace-nowrap')}>
                      <span className={cn('font-bold tabular-nums', amcatTone(amcatAvg))}>
                        {amcatAvg ?? '—'}
                      </span>
                      <span className="block text-[11px] text-slate-500 tabular-nums">
                        {amcatRounds} round{amcatRounds === 1 ? '' : 's'}
                      </span>
                    </td>
                    {roundColumns.map((round) => {
                      const result = student.amcat_rounds[round.test_name];
                      return (
                        <td
                          key={round.test_name}
                          className="px-3 py-2.5 text-right whitespace-nowrap"
                        >
                          {!result ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <>
                              <span
                                className={cn(
                                  'font-semibold tabular-nums',
                                  amcatTone(result.score)
                                )}
                              >
                                {result.score ?? '—'}
                              </span>
                              <span className="block text-[11px] text-slate-500">
                                {lmsDate(result.taken_on)}
                              </span>
                            </>
                          )}
                        </td>
                      );
                    })}

                    <td className={cn(group, 'px-3 py-2.5 text-right whitespace-nowrap')}>
                      <span
                        className={cn(
                          'font-bold tabular-nums',
                          attendanceTone(student.attendance_pct)
                        )}
                      >
                        {student.attendance_pct === null ? '—' : `${student.attendance_pct}%`}
                      </span>
                      {student.prime_attendance_pct !== null && (
                        <span className="block text-[11px] text-slate-500 tabular-nums">
                          PRIME {student.prime_attendance_pct}%
                        </span>
                      )}
                      <Sparkline
                        values={trends?.[student.username]?.attendance_weeks ?? []}
                        width={60}
                        height={16}
                        className="mt-0.5 ml-auto block"
                      />
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums',
                        scoreTone(student.exam_avg)
                      )}
                    >
                      {student.exam_avg === null ? '—' : `${student.exam_avg}%`}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span
                        className={cn('font-semibold tabular-nums', scoreTone(student.avg_pct))}
                      >
                        {student.avg_pct === null ? '—' : `${student.avg_pct}%`}
                      </span>
                      <span className="block text-[11px] text-slate-500 tabular-nums">
                        {student.submitted}/{student.released} done
                      </span>
                    </td>
                    <td className="px-3 py-2.5 pr-5 text-xs whitespace-nowrap text-slate-600">
                      {lmsDate(student.last_submitted_at)}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          {!rows.length && <p className="px-5 py-6 text-sm text-slate-500">No student matches.</p>}
        </div>
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-semibold transition',
        active
          ? 'border-brand-700 bg-brand-700 text-white'
          : 'border-slate-200 text-slate-600 hover:border-slate-300'
      )}
    >
      {children}
    </button>
  );
}

const BANDS = [
  { label: '0–24%', from: 0, to: 25 },
  { label: '25–49%', from: 25, to: 50 },
  { label: '50–74%', from: 50, to: 75 },
  { label: '75–100%', from: 75, to: 101 },
];

function TestPanel({
  campusId,
  batch,
  test,
  onClose,
}: {
  campusId: number;
  batch?: string;
  test: string;
  onClose: () => void;
}) {
  const detail = useTestDetail(campusId, batch, test);
  const colors = chartColors(useTheme());

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  const students = detail.data?.students ?? [];
  const done = students.filter((student) => student.submitted);
  const pending = students.filter((student) => !student.submitted);
  const scores = done.map((student) => student.pct ?? 0);
  const average = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  const spread = scores.length
    ? Math.sqrt(
        scores.reduce((sum, score) => sum + score * score, 0) / scores.length -
          (scores.reduce((sum, score) => sum + score, 0) / scores.length) ** 2
      )
    : null;
  const integrity = detail.data
    ? integrityOf({
        category: detail.data.test.category,
        submitted: scores.length,
        perfect: scores.filter((score) => score >= 100).length,
        avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
        spread,
      })
    : null;
  const bands = BANDS.map((band) => ({
    ...band,
    students: scores.filter((score) => score >= band.from && score < band.to).length,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Test results"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
      />
      <aside className="bg-surface animate-rise relative flex h-full w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
        <header className="from-brand-700 to-brand-900 bg-gradient-to-br px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {detail.data && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    CATEGORY_STYLES[detail.data.test.category]
                  )}
                >
                  {CATEGORY_LABELS[detail.data.test.category]}
                </span>
              )}
              <h2 className="mt-1.5 text-xl font-bold">{detail.data?.test.name ?? 'Test'}</h2>
              {detail.data && (
                <p className="text-brand-100 text-sm">
                  {detail.data.test.max_marks && `${Number(detail.data.test.max_marks)} marks`}
                  {detail.data.test.minutes ? ` · ${detail.data.test.minutes} min` : ''}
                  {detail.data.test.copies > 1
                    ? ` · given to ${detail.data.test.copies} sections`
                    : ''}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {detail.data && (
            <dl className="mt-4 grid grid-cols-3 gap-2">
              <HeroStat
                icon={ClipboardCheck}
                label="Submitted"
                value={`${done.length}/${students.length}`}
              />
              <HeroStat
                icon={Target}
                label="Average"
                value={average === null ? '—' : `${average}%`}
              />
              <HeroStat
                icon={Trophy}
                label="Top score"
                value={scores.length ? `${Math.max(...scores)}%` : '—'}
              />
            </dl>
          )}
        </header>
        {integrity && (
          <div
            role="note"
            className={cn(
              'flex items-start gap-3 border-b px-5 py-3 text-sm',
              integrity.level === 'high'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            )}
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">
                {integrity.level === 'high'
                  ? 'Possible copying: these scores are unusually high'
                  : 'Check these scores: higher and more uniform than usual'}
              </p>
              <ul className="mt-0.5 list-disc pl-4 text-xs">
                {integrity.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs opacity-80">{INTEGRITY_NOTE}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {detail.isPending ? (
            <Loading variant="plain" label="Loading results…" />
          ) : detail.isError ? (
            <Problem message={detail.error.message} />
          ) : (
            <div className="space-y-5">
              {scores.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Score distribution</h3>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bands} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                        <CartesianGrid
                          stroke={colors.grid}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: colors.tick }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: colors.tick }}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: colors.cursor }}
                          contentStyle={{
                            background: colors.tooltip,
                            border: `1px solid ${colors.grid}`,
                            borderRadius: 12,
                            color: colors.text,
                            fontSize: 12,
                          }}
                          formatter={(value) => [value, 'Students']}
                        />
                        <Bar dataKey="students" radius={[6, 6, 0, 0]} animationDuration={900}>
                          {bands.map((band) => (
                            <Cell key={band.label} fill={scoreFill(band.from + 1)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Results · {done.length}</h3>
                <ol className="divide-y divide-dotted divide-slate-200 rounded-xl border border-slate-200">
                  {done.map((student, index) => (
                    <li key={student.username} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-6 text-right text-xs text-slate-400 tabular-nums">
                        {index + 1}
                      </span>
                      <Avatar name={student.name} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/s/$slug"
                          params={{ slug: student.username }}
                          className="text-brand-700 dark:text-brand-300 block truncate text-sm font-semibold hover:underline"
                        >
                          {student.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {student.program} {student.admission_year} ·{' '}
                          {lmsDate(student.submitted_at, true)}
                          {student.attempts && student.attempts > 1
                            ? ` · ${student.attempts} attempts`
                            : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-bold tabular-nums', scoreTone(student.pct))}>
                          {student.pct}%
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {Number(student.marks ?? 0)}/{Number(student.max_marks ?? 0)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {pending.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Not submitted · {pending.length}</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {pending.map((student) => (
                      <li key={student.username}>
                        <Link
                          to="/s/$slug"
                          params={{ slug: student.username }}
                          className="inline-block rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          {student.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
