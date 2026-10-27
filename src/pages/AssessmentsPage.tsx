import { useEffect, useMemo } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BookOpenCheck,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  Target,
  Trophy,
  Users,
  X,
} from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  lmsDate,
  percent,
  scoreFill,
  scoreTone,
  useCampusDetail,
  useCampusOverview,
  useTestDetail,
  type CampusOverview,
  type CampusSubject,
  type CampusTest,
  type TestCategory,
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

function CampusView({ campusId, name }: { campusId: number; name?: string }) {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const detail = useCampusDetail(campusId, search.batch);
  const set = (patch: Partial<typeof search>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const tests = useMemo(
    () =>
      (detail.data?.tests ?? []).filter((test) => !search.type || test.category === search.type),
    [detail.data, search.type]
  );

  if (detail.isPending) return <Loading label="Loading the campus…" />;
  if (detail.isError) return <Problem message={detail.error.message} />;

  const { summary, subjects, batches, syncedAt } = detail.data;
  const modules = subjects.reduce(
    (sum, subject) => ({
      total: sum.total + subject.modules_list.length,
      started: sum.started + subject.modules_list.filter((module) => module.started).length,
    }),
    { total: 0, started: 0 }
  );
  const counts = CATEGORIES.map((category) => ({
    category,
    count: detail.data.tests.filter((test) => test.category === category).length,
  }));

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
          PRIME domain · Prime Domain Coding{syncedAt && ` · updated ${lmsDate(syncedAt, true)}`}
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
          <HeroStat icon={BookOpenCheck} label="Tests held" value={String(summary.tests)} />
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
            icon={GraduationCap}
            label="In PRIME sections"
            value={String(summary.in_prime)}
            note={`of ${summary.students}`}
          />
          <HeroStat
            icon={CalendarDays}
            label="Syllabus started"
            value={`${percent(modules.started, modules.total)}%`}
            note={`${modules.started}/${modules.total} modules`}
          />
        </dl>
      </section>

      {subjects.length > 0 && (
        <section className={cn(panel, 'p-5')}>
          <h2 className="text-lg font-bold">Syllabus</h2>
          <p className="text-sm text-slate-500">
            Modules of each PRIME domain subject; a module counts as started once a test from it is
            released.
          </p>
          <div className="mt-4 space-y-5">
            {subjects.map((subject) => (
              <SubjectSyllabus key={subject.id} subject={subject} />
            ))}
          </div>
        </section>
      )}

      <section className={cn(panel, 'overflow-hidden')}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-lg font-bold">Tests</h2>
            <p className="text-sm text-slate-500">
              Newest first. Open a test for every student's marks.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Test type">
            <FilterChip active={!search.type} onClick={() => set({ type: undefined })}>
              All · {detail.data.tests.length}
            </FilterChip>
            {counts
              .filter(({ count }) => count > 0)
              .map(({ category, count }) => (
                <FilterChip
                  key={category}
                  active={search.type === category}
                  onClick={() => set({ type: category })}
                >
                  {CATEGORY_LABELS[category]} · {count}
                </FilterChip>
              ))}
          </div>
        </div>
        {tests.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-y border-slate-200">
                  <th className="px-5 py-2 font-medium">Test</th>
                  <th className="px-3 py-2 font-medium">Released</th>
                  <th className="px-3 py-2 font-medium">Participation</th>
                  <th className="px-3 py-2 text-right font-medium">Average</th>
                  <th className="px-5 py-2 text-right font-medium">Top</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <TestRow
                    key={test.ids.join(',')}
                    test={test}
                    onOpen={() => set({ test: test.ids.join(',') })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-500">
            No tests released for this selection yet.
          </p>
        )}
      </section>

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

function SubjectSyllabus({ subject }: { subject: CampusSubject }) {
  const started = subject.modules_list.filter((module) => module.started).length;
  const share = percent(started, subject.modules_list.length);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {subject.name}
          <span className="ml-2 text-xs font-normal text-slate-500">
            {subject.students} students · {subject.tests} tests · {subject.lectures} lectures
          </span>
        </p>
        <p className="text-sm text-slate-600 tabular-nums">
          {started} of {subject.modules_list.length} modules started
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="from-brand-500 to-brand-700 h-full rounded-full bg-gradient-to-r transition-[width] duration-700"
          style={{ width: `${share}%` }}
        />
      </div>
      <ol className="mt-3 flex flex-wrap gap-1.5">
        {subject.modules_list.map((module, index) => (
          <li
            key={module.id}
            title={
              module.started
                ? `${module.tests} test${module.tests === 1 ? '' : 's'} released`
                : 'Not started'
            }
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs',
              module.started
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-slate-200 text-slate-500'
            )}
          >
            {module.started ? (
              <Check className="size-3" aria-hidden />
            ) : (
              <span className="text-[10px] tabular-nums">{index + 1}</span>
            )}
            {module.name}
          </li>
        ))}
      </ol>
    </div>
  );
}

function TestRow({ test, onOpen }: { test: CampusTest; onOpen: () => void }) {
  const participation = percent(test.submitted, test.eligible);
  return (
    <tr
      onClick={onOpen}
      className="hover:bg-brand-50/50 dark:hover:bg-brand-900/30 cursor-pointer border-b border-dotted border-slate-200 last:border-0"
    >
      <td className="px-5 py-3">
        <button
          type="button"
          onClick={onOpen}
          className="text-brand-700 dark:text-brand-300 text-left font-semibold hover:underline"
        >
          {test.name}
        </button>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span
            className={cn(
              'rounded-full px-1.5 py-px text-[10px] font-semibold',
              CATEGORY_STYLES[test.category]
            )}
          >
            {CATEGORY_LABELS[test.category]}
          </span>
          {test.module}
          {test.max_marks && <span>· {Number(test.max_marks)} marks</span>}
          {test.ids.length > 1 && <span>· {test.ids.length} sections</span>}
        </p>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-slate-600">{lmsDate(test.released_at)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${participation}%`, backgroundColor: scoreFill(participation) }}
            />
          </div>
          <span className="text-xs whitespace-nowrap text-slate-600 tabular-nums">
            {test.submitted}/{test.eligible}
          </span>
        </div>
      </td>
      <td className={cn('px-3 py-3 text-right font-bold tabular-nums', scoreTone(test.avg_pct))}>
        {test.avg_pct === null ? '—' : `${test.avg_pct}%`}
      </td>
      <td className="px-5 py-3 text-right text-slate-600 tabular-nums">
        {test.top_pct === null ? '—' : `${test.top_pct}%`}
      </td>
    </tr>
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
