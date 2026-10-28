import { useEffect, useState } from 'react';
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
  Loader2,
  Search,
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
import { ExamsTab } from '@/components/assessments/ExamsSection';
import { Avatar } from '@/components/common/Avatar';
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
  useTestDetail,
  type CampusDetail,
  type CampusOverview,
  type CampusStudentRow,
  type CampusTest,
  type SubjectTest,
  type TestCategory,
  type TestStatus,
} from '@/lib/assessments';
import { useSession } from '@/lib/session';
import { chartColors, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const route = getRouteApi('/assessments');

const heroClass =
  'from-brand-700 via-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7';
const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';

function Loading({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-slate-600">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </p>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

/** A small ring showing a percentage. */
function Ring({ value, size = 56 }: { value: number | null; size?: number }) {
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const shown = value ?? 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={6}
        className="stroke-slate-200"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={6}
        strokeLinecap="round"
        stroke={scoreFill(value)}
        strokeDasharray={`${(shown / 100) * circumference} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-slate-800 text-[13px] font-bold"
      >
        {value === null ? '—' : `${value}%`}
      </text>
    </svg>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col-reverse rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
      <dt className="text-brand-100 mt-0.5 flex items-center gap-1.5 text-xs">
        <Icon className="text-brand-200 size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="text-2xl font-bold tabular-nums">
        {value}
        {note && <span className="text-brand-200 ml-1 text-sm font-medium">{note}</span>}
      </dd>
    </div>
  );
}

/** PRIME domain assessments: every campus, then one campus's syllabus and tests. */
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
    const name = overview.data?.campuses.find((campus) => campus.id === search.campus)?.name;
    return <CampusView campusId={search.campus} name={name} />;
  }
  if (overview.isPending) return <Loading label="Loading assessments…" />;
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
        <p className="text-brand-200 text-xs font-semibold tracking-[0.2em] uppercase">
          PRIME domain assessments
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Tests across campuses
        </h1>
        <p className="text-brand-100 mt-2 max-w-2xl text-sm">
          Prime Domain Coding tests from the Sunstone LMS: what has been released, who took part and
          how they scored.{syncedAt && ` Updated ${lmsDate(syncedAt, true)}.`}
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

function CampusCard({ campus }: { campus: CampusOverview }) {
  const participation = campus.expected ? percent(campus.submissions, campus.expected) : null;
  return (
    <Link
      to="/assessments"
      search={{ campus: campus.id }}
      className={cn(
        panel,
        'group hover:border-brand-300 block p-5 transition hover:-translate-y-0.5 hover:shadow-lg',
        !campus.tests && 'opacity-70'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold" title={campus.name}>
            {campus.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {campus.in_prime} of {campus.students} students in PRIME sections
          </p>
        </div>
        <ChevronRight
          className="group-hover:text-brand-600 size-4 shrink-0 text-slate-300 transition"
          aria-hidden
        />
      </div>
      {campus.tests ? (
        <div className="mt-4 flex items-center gap-4">
          <div className="flex flex-col items-center">
            <Ring value={participation} />
            <span className="mt-1 text-[10px] text-slate-500">Participation</span>
          </div>
          <div className="flex flex-col items-center">
            <Ring value={campus.avg_pct} />
            <span className="mt-1 text-[10px] text-slate-500">Avg score</span>
          </div>
          <div className="flex flex-col items-center">
            <Ring value={campus.attendance_pct} />
            <span className="mt-1 text-[10px] text-slate-500">Attendance</span>
          </div>
          <dl className="ml-auto text-right text-xs text-slate-500">
            <dt>Tests</dt>
            <dd className="text-lg font-bold text-slate-800 tabular-nums">{campus.tests}</dd>
            <dt className="mt-1">Last test</dt>
            <dd className="font-medium text-slate-700">{lmsDate(campus.last_test_at)}</dd>
          </dl>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <CircleDashed className="size-4" aria-hidden />
          No PRIME domain tests released yet
        </p>
      )}
    </Link>
  );
}

const CATEGORIES: TestCategory[] = ['assignment', 'test', 'mcq', 'amcat_mock'];

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'subject', label: 'Subject tests', icon: Trophy },
  { id: 'modules', label: 'Module tests', icon: FolderTree },
  { id: 'exams', label: 'Exams', icon: NotebookPen },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'amcat', label: 'AMCAT', icon: Award },
  { id: 'students', label: 'Students', icon: Users },
] as const;

const isOut = (test: CampusTest) => test.status === 'completed' || test.status === 'live';

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

function CampusView({ campusId, name }: { campusId: number; name?: string }) {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const detail = useCampusDetail(campusId, search.batch);
  const set = (patch: Partial<typeof search>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  const tab = TABS.some((item) => item.id === search.tab) ? search.tab! : 'overview';

  if (detail.isPending) return <Loading label="Loading the campus…" />;
  if (detail.isError) return <Problem message={detail.error.message} />;

  const data = detail.data;
  const { summary, batches, syncedAt } = data;
  const open = (test: CampusTest) => isOut(test) && set({ test: test.ids.join(',') });

  return (
    <div className="rise-stagger space-y-5">
      <section className={heroClass}>
        <nav aria-label="Breadcrumb" className="text-brand-100 flex items-center gap-1.5 text-sm">
          <Link to="/assessments" className="hover:text-white hover:underline">
            Assessments
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span className="font-medium text-white">{name ?? 'Campus'}</span>
        </nav>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{name ?? 'Campus'}</h1>
        <p className="text-brand-100 mt-1 text-sm">
          PRIME domain journey ·{' '}
          {data.subjects.map((subject) => subject.name).join(', ') || 'Prime Domain Coding'}
          {syncedAt && ` · updated ${lmsDate(syncedAt, true)}`}
        </p>

        {batches.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Batch">
            {[undefined, ...batches].map((batch) => (
              <button
                key={batch ?? 'all'}
                type="button"
                onClick={() => set({ batch, test: undefined })}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition',
                  search.batch === batch
                    ? 'text-brand-800 bg-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                )}
              >
                {batch ? `Batch ${batch}` : 'All batches'}
              </button>
            ))}
          </div>
        )}

        <dl className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <HeroStat
            icon={BookOpenCheck}
            label="Tests held"
            value={String(summary.tests)}
            note={summary.scheduled ? `+${summary.scheduled} scheduled` : undefined}
          />
          <HeroStat
            icon={Users}
            label="Participation"
            value={`${percent(summary.submissions, summary.expected)}%`}
            note={`${summary.submissions.toLocaleString('en-IN')} subs`}
          />
          <HeroStat
            icon={Target}
            label="Average score"
            value={summary.avg_pct === null ? '—' : `${summary.avg_pct}%`}
          />
          <HeroStat
            icon={CalendarCheck}
            label="Attendance"
            value={data.attendance.pct === null ? '—' : `${data.attendance.pct}%`}
            note={
              data.attendance.prime_pct === null ? undefined : `PRIME ${data.attendance.prime_pct}%`
            }
          />
          <HeroStat
            icon={CalendarDays}
            label="Syllabus started"
            value={`${percent(summary.modules_started, summary.modules)}%`}
            note={`${summary.modules_started}/${summary.modules} modules`}
          />
        </dl>
      </section>

      <nav
        aria-label="Campus sections"
        className="flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-none"
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
        <OverviewTab data={data} onOpen={open} onTab={(id) => set({ tab: id })} />
      )}
      {tab === 'subject' && <SubjectTestsTab tests={data.subjectTests} onOpen={open} />}
      {tab === 'modules' && (
        <ModulesTab data={data} onOpen={open} type={search.type} onType={(type) => set({ type })} />
      )}
      {tab === 'exams' && <ExamsTab data={data.exams} />}
      {tab === 'attendance' && <AttendanceTab data={data.attendance} />}
      {tab === 'amcat' && <AmcatTab data={data.amcat} />}
      {tab === 'students' && <StudentsTab students={data.students} />}

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

function Count({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600 tabular-nums">
      {n}
    </span>
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
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="avg_pct"
                  stroke="#1a3e70"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
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
                <span className="shrink-0 text-right">
                  <StatusChip status={test.status} />
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
            <h2 className="text-lg font-bold">Syllabus</h2>
            <p className="text-sm text-slate-500">
              Each module of the PRIME domain subject: tests released out of all its tests.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onTab('modules')}
            className="text-brand-700 dark:text-brand-300 text-sm font-semibold hover:underline"
          >
            Open module tests →
          </button>
        </div>
        {data.subjects.map((subject) => (
          <div key={subject.key} className="mt-4">
            {data.subjects.length > 1 && <p className="mb-2 font-semibold">{subject.name}</p>}
            <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {subject.modules.map((module, index) => {
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
                          (state === 'upcoming' || state === 'empty') &&
                            'bg-slate-100 text-slate-500'
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
                                'h-full rounded-full',
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
          </div>
        ))}
      </section>
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
}: {
  tests: SubjectTest[];
  onOpen: (test: CampusTest) => void;
}) {
  const order: TestStatus[] = ['live', 'completed', 'scheduled', 'unscheduled'];
  const sorted = [...tests].sort(
    (a, b) =>
      order.indexOf(a.status) - order.indexOf(b.status) ||
      (b.released_at ?? '').localeCompare(a.released_at ?? '') ||
      a.name.localeCompare(b.name, undefined, { numeric: true })
  );
  if (!sorted.length) {
    return (
      <p className={cn(panel, 'p-5 text-sm text-slate-500')}>
        No subject-level tests (such as AMCAT mocks) for this campus yet.
      </p>
    );
  }
  return (
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
              <StatusChip status={test.status} />
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
  );
}

function ModulesTab({
  data,
  onOpen,
  type,
  onType,
}: {
  data: CampusDetail;
  onOpen: (test: CampusTest) => void;
  type?: string;
  onType: (type: string | undefined) => void;
}) {
  const moduleTests = data.subjects.flatMap((subject) =>
    subject.modules.flatMap((module) => [
      ...module.tests,
      ...module.folders.flatMap((folder) => folder.tests),
    ])
  );
  const keep = (test: CampusTest) => !type || test.category === type;
  const counts = CATEGORIES.map((category) => ({
    category,
    count: moduleTests.filter((test) => test.category === category).length,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Test type">
        <FilterChip active={!type} onClick={() => onType(undefined)}>
          All · {moduleTests.length}
        </FilterChip>
        {counts
          .filter(({ count }) => count > 0)
          .map(({ category, count }) => (
            <FilterChip key={category} active={type === category} onClick={() => onType(category)}>
              {CATEGORY_LABELS[category]} · {count}
            </FilterChip>
          ))}
      </div>
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
                open={module.started}
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

function StudentsTab({ students }: { students: CampusStudentRow[] }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = students.filter(
    (student) => !needle || student.name.toLowerCase().includes(needle)
  );
  return (
    <div className="space-y-5">
      <InsightsPanel students={students} />
      <section className={cn(panel, 'overflow-hidden')}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-lg font-bold">Students</h2>
            <p className="text-sm text-slate-500">
              Every student in PRIME sections, by average score. Open one for their full journey.
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
              <tr className="border-y border-slate-200">
                <th className="w-10 px-5 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Tests taken</th>
                <th className="px-3 py-2 text-right font-medium">Average</th>
                <th className="px-3 py-2 text-right font-medium">Attendance</th>
                <th className="px-3 py-2 text-right font-medium">Exams avg</th>
                <th className="px-3 py-2 text-right font-medium">Attendance</th>
                <th className="px-3 py-2 text-right font-medium">Exams avg</th>
                <th className="px-3 py-2 font-medium">Last submission</th>
                <th className="px-5 py-2 text-right font-medium">AMCAT avg</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((student, index) => {
                const taken = percent(student.submitted, student.released);
                return (
                  <tr
                    key={student.username}
                    className="border-b border-dotted border-slate-200 last:border-0"
                  >
                    <td className="px-5 py-2.5 text-xs text-slate-400 tabular-nums">{index + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={student.name} className="size-8" />
                        <div className="min-w-0">
                          <Link
                            to="/s/$slug"
                            params={{ slug: student.username }}
                            className="text-brand-700 dark:text-brand-300 block truncate font-semibold hover:underline"
                          >
                            {student.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {student.program} {student.admission_year}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${taken}%`, backgroundColor: scoreFill(taken) }}
                          />
                        </div>
                        <span className="text-xs text-slate-600 tabular-nums">
                          {student.submitted}/{student.released}
                        </span>
                      </div>
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right font-bold tabular-nums',
                        scoreTone(student.avg_pct)
                      )}
                    >
                      {student.avg_pct === null ? '—' : `${student.avg_pct}%`}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
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
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right font-semibold tabular-nums',
                        scoreTone(student.exam_avg)
                      )}
                    >
                      {student.exam_avg === null ? '—' : `${student.exam_avg}%`}
                    </td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-600">
                      {lmsDate(student.last_submitted_at)}
                    </td>
                    <td
                      className={cn(
                        'px-5 py-2.5 text-right font-semibold tabular-nums',
                        scoreTone(student.amcat_avg)
                      )}
                    >
                      {student.amcat_avg ?? '—'}
                      {student.amcat > 1 && (
                        <span className="block text-[11px] font-normal text-slate-500">
                          {student.amcat} rounds
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!shown.length && <p className="px-5 py-6 text-sm text-slate-500">No student matches.</p>}
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
  batch?: number;
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

        <div className="flex-1 overflow-y-auto p-5">
          {detail.isPending ? (
            <Loading label="Loading results…" />
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
                        <Bar dataKey="students" radius={[6, 6, 0, 0]} isAnimationActive={false}>
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
