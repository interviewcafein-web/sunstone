import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
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
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Folder,
  FolderTree,
  LayoutDashboard,
  MessagesSquare,
  NotebookPen,
  Target,
  Users,
} from 'lucide-react';

import { AmcatTab, AttendanceTab } from '@/components/assessments/CampusInsights';
import { ExamsTab } from '@/components/assessments/ExamsSection';
import { PeriodFilter, inPeriod, type PeriodChoice } from '@/components/assessments/PeriodFilter';
import { AnimatedRing } from '@/components/common/AnimatedRing';
import { CampusLogo } from '@/components/common/CampusLogo';
import { PageLoader } from '@/components/common/PageLoader';
import { useStudents } from '@/hooks/useStudents';
import {
  lmsDate,
  percent,
  scoreFill,
  scoreTone,
  useCampusDetail,
  useCampusOverview,
  useStudentMetrics,
  type CampusDetail,
  type CampusTest,
  type SyllabusModule,
} from '@/lib/assessments';
import { cohortYears, parseBatch } from '@/lib/cohorts';
import { chartColors, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

import { CategoryChip, StatusChip, tidy } from '../components/chips';
import { StudentTable } from '../components/StudentTable';
import { TestPanel } from '../components/TestPanel';
import {
  Empty,
  Hero,
  HeroStat,
  Problem,
  SectionTitle,
  Tabs,
  heroGrid,
  panel,
} from '../components/ui';
import { inBatch, sortRows, toRow, type SortKey } from '../lib/rows';
import { TRACKS, trackOf, type Track } from '../lib/subjects';
import { Link, useRouteParams, useRouteSearch, useSetSearch } from '../nav';
import type { CampusSearch } from '../routes';

type TabId = 'overview' | Track | 'amcat' | 'exams' | 'attendance' | 'students';

const isOut = (test: CampusTest) => test.status === 'completed' || test.status === 'live';

/** Subjects are keyed by their lower-cased name (api/assessments.ts). */
const sameSubject = (name: string | null, key: string) => name?.trim().toLowerCase() === key;

/** Every test of the subjects in a track: on the subject itself and in its modules. */
function testsOf(data: CampusDetail, track?: Track): CampusTest[] {
  const subjects = data.subjects.filter((subject) => !track || trackOf(subject.name) === track);
  return [
    ...data.subjectTests.filter((test) => !track || trackOf(test.subject) === track),
    ...subjects.flatMap((subject) =>
      subject.modules.flatMap((module) => [
        ...module.tests,
        ...module.folders.flatMap((folder) => folder.tests),
      ])
    ),
  ];
}

/** Average score over the tests that are out, weighted by how many took each. */
function weightedAverage(tests: CampusTest[]) {
  const out = tests.filter(isOut);
  const submitted = out.reduce((sum, test) => sum + test.submitted, 0);
  return submitted
    ? Math.round(
        out.reduce((sum, test) => sum + (test.avg_pct ?? 0) * test.submitted, 0) / submitted
      )
    : null;
}

/** One campus: PRIME subjects and modules, tests, AMCAT, internal exams, attendance, students. */
export default function CampusPage() {
  const campusId = Number(useRouteParams().id);
  const search = useRouteSearch<CampusSearch>();
  const setSearch = useSetSearch<CampusSearch>();
  const overview = useCampusOverview();
  const detail = useCampusDetail(Number.isFinite(campusId) ? campusId : undefined, search.batch);
  const picked = overview.data?.campuses.find((campus) => campus.id === campusId);
  const name = picked?.name;

  const choice: PeriodChoice = { year: search.year, term: search.term, q: search.q };
  const setChoice = (next: PeriodChoice) =>
    setSearch({ year: next.year, term: next.term, q: next.q });

  if (detail.isPending) return <PageLoader variant="table" label="Loading the campus" />;
  if (detail.isError)
    return <Problem message={detail.error.message} onRetry={() => detail.refetch()} />;

  const data = detail.data;
  const { summary, batches, syncedAt } = data;
  const domainTests = testsOf(data, 'domain');
  const elqTests = testsOf(data, 'elq');
  const tabs: { id: TabId; label: string; icon: typeof Users; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'domain',
      label: TRACKS.domain.label,
      icon: BriefcaseBusiness,
      count: domainTests.filter(isOut).length,
    },
    {
      id: 'elq',
      label: TRACKS.elq.label,
      icon: MessagesSquare,
      count: elqTests.filter(isOut).length,
    },
    { id: 'amcat', label: 'AMCAT', icon: Award },
    { id: 'exams', label: 'Internal Exams', icon: NotebookPen },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'students', label: 'Students', icon: Users, count: summary.students },
  ];
  const tab = (tabs.some((item) => item.id === search.tab) ? search.tab : 'overview') as TabId;
  const open = (test: CampusTest) => isOut(test) && setSearch({ test: test.ids.join(',') });
  const domainAvg = weightedAverage(domainTests);
  const elqAvg = weightedAverage(elqTests);

  return (
    <div className="rise-stagger space-y-5">
      <Hero
        eyebrow={
          <span className="flex items-center gap-1.5 tracking-normal normal-case">
            <Link to="/campuses" className="hover:text-white hover:underline">
              Campuses
            </Link>
            <ChevronRight className="hidden size-3.5 sm:block" aria-hidden />
            <span className="hidden text-white sm:inline">{name ?? 'Campus'}</span>
          </span>
        }
        title={
          <span className="flex items-center gap-3">
            {name && <CampusLogo name={name} logo={picked?.logo} className="size-12 sm:size-14" />}
            {name ?? 'Campus'}
          </span>
        }
      >
        <p className="text-brand-100 relative mt-2 text-sm">
          {summary.students.toLocaleString('en-IN')} students · {data.subjects.length} PRIME
          subjects
          {syncedAt && ` · updated ${lmsDate(syncedAt, true)}`}
        </p>

        {batches.length > 1 && (
          <BatchPicker
            batches={batches}
            value={search.batch}
            onChange={(batch) => setSearch({ batch, test: undefined })}
          />
        )}

        <dl className={cn(heroGrid, 'mt-5')}>
          <HeroStat
            icon={BookOpenCheck}
            label="Tests Held"
            value={summary.tests}
            note={summary.scheduled ? `+${summary.scheduled} scheduled` : undefined}
          />
          <HeroStat
            icon={Users}
            label="Participation"
            value={percent(summary.submissions, summary.expected)}
            suffix="%"
            trend={data.timeline.map((week) => week.participation)}
          />
          <HeroStat
            icon={BriefcaseBusiness}
            label={TRACKS.domain.label}
            value={domainAvg}
            suffix="%"
          />
          <HeroStat icon={MessagesSquare} label={TRACKS.elq.short} value={elqAvg} suffix="%" />
          <HeroStat
            icon={CalendarCheck}
            label="Attendance"
            value={data.attendance.pct}
            suffix="%"
            note={
              data.attendance.prime_pct === null ? undefined : `PRIME ${data.attendance.prime_pct}%`
            }
            trend={data.attendance.weeks.slice(-10).map((week) => week.pct)}
          />
        </dl>
      </Hero>

      <Tabs
        tabs={tabs}
        value={tab}
        onChange={(id) => setSearch({ tab: id === 'overview' ? undefined : id })}
        label="Campus sections"
      />

      {tab === 'overview' && (
        <OverviewTab data={data} onOpen={open} onTab={(id) => setSearch({ tab: id })} />
      )}
      {(tab === 'domain' || tab === 'elq') && (
        <TrackTab data={data} track={tab} onOpen={open} choice={choice} onChoice={setChoice} />
      )}
      {tab === 'amcat' && <AmcatTab data={data.amcat} choice={choice} onChoice={setChoice} />}
      {tab === 'exams' && <ExamsTab data={data.exams} />}
      {tab === 'attendance' && (
        <AttendanceTab
          data={data.attendance}
          instructorNote="PRIME domain instructors, with attendance in their PRIME domain classes. Communication and aptitude classes are in the subject list."
        />
      )}
      {tab === 'students' && name && <StudentsTab campus={name} batch={search.batch} />}

      {search.test && (
        <TestPanel
          campusId={campusId}
          batch={search.batch}
          test={search.test}
          onClose={() => setSearch({ test: undefined })}
        />
      )}
    </div>
  );
}

// --- Batches ------------------------------------------------------------------------------

const pillClass = (on: boolean) =>
  cn(
    'rounded-full px-3 py-1 text-xs font-semibold transition',
    on ? 'text-brand-800 bg-white' : 'bg-white/10 text-white hover:bg-white/20'
  );

/** Programs first (All Batches, BBA, MBA), then that program's years once one is picked. */
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
  const programs = [...new Set(batches.map((batch) => batch.program))];
  const cohorts = batches.filter((batch) => batch.program === program);
  return (
    <div className="relative mt-4 space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Program">
        <button type="button" onClick={() => onChange(undefined)} className={pillClass(!value)}>
          All Batches
        </button>
        {programs.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange(`${name}:`)}
            className={pillClass(program === name)}
          >
            {name}
          </button>
        ))}
      </div>
      {program && cohorts.length > 1 && (
        <div
          className="animate-rise flex flex-wrap items-center gap-1.5 border-l-2 border-[#d9a54a]/60 pl-3"
          role="group"
          aria-label={`${program} batches`}
        >
          <button
            type="button"
            onClick={() => onChange(`${program}:`)}
            className={pillClass(value === `${program}:`)}
          >
            All Years
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

// --- Overview -----------------------------------------------------------------------------

function OverviewTab({
  data,
  onOpen,
  onTab,
}: {
  data: CampusDetail;
  onOpen: (test: CampusTest) => void;
  onTab: (tab: Track) => void;
}) {
  const colors = chartColors(useTheme());
  const tests = testsOf(data);
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
    <div className="grid items-start gap-5 lg:grid-cols-3 [&>*]:min-w-0">
      <div className="space-y-5 lg:col-span-2">
        <section className={cn(panel, 'p-5')}>
          <SectionTitle
            title="Journey"
            description="Tests released each week, and how the class scored."
          />
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
                    fill="#e9c27a"
                    radius={[6, 6, 0, 0]}
                    animationDuration={900}
                  />
                  <Line
                    yAxisId="pct"
                    type="monotone"
                    dataKey="avg_pct"
                    stroke="#3863a0"
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
        <SubjectScores data={data} />
      </div>

      <section className={cn(panel, 'p-5')}>
        <SectionTitle title="Up Next" />
        <ul className="mt-3 space-y-2">
          {[...live, ...scheduled].slice(0, 6).map((test) => (
            <li key={test.ids.join(',')}>
              <button
                type="button"
                onClick={() => onOpen(test)}
                disabled={!isOut(test)}
                className="enabled:hover:border-brand-300 flex w-full items-start justify-between gap-2 rounded-xl border border-slate-200 p-3 text-left transition"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{test.name}</span>
                  <span className="block truncate text-xs text-slate-500">{test.subject}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
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
            <h3 className="mt-5 text-sm font-semibold text-slate-600">Recently Completed</h3>
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

      {(['domain', 'elq'] as const).map((track) => {
        const subjects = data.subjects.filter((subject) => trackOf(subject.name) === track);
        if (!subjects.length) return null;
        return (
          <section key={track} className={cn(panel, 'p-5 lg:col-span-3')}>
            <SectionTitle
              icon={track === 'domain' ? BriefcaseBusiness : MessagesSquare}
              title={`${TRACKS[track].label} Coverage`}
              description="Each module: tests released out of all its tests."
              aside={
                <button
                  type="button"
                  onClick={() => onTab(track)}
                  className="text-brand-700 dark:text-brand-300 text-sm font-semibold hover:underline"
                >
                  Open {TRACKS[track].label} →
                </button>
              }
            />
            {subjects.map((subject) => (
              <div key={subject.key} className="mt-4">
                <p className="mb-2 flex items-center gap-2 font-semibold">
                  {subject.name}
                  <span className="text-xs font-normal text-slate-500">
                    {subject.modules.filter((module) => module.started).length} of{' '}
                    {subject.modules.length} modules started
                  </span>
                </p>
                <ModuleGrid modules={subject.modules} />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** Each PRIME subject's average score and participation, domain subjects first. */
function SubjectScores({ data }: { data: CampusDetail }) {
  const subjects = [...data.subjects].sort(
    (a, b) =>
      Number(trackOf(a.name) === 'elq') - Number(trackOf(b.name) === 'elq') ||
      a.name.localeCompare(b.name)
  );
  if (!subjects.length) return null;
  return (
    <section className={cn(panel, 'p-5')}>
      <SectionTitle
        title="PRIME Subjects"
        description="Average score and share of tests taken, over the tests released so far."
      />
      <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {subjects.map((subject) => {
          const track = trackOf(subject.name);
          const tests = [
            ...data.subjectTests.filter((test) => sameSubject(test.subject, subject.key)),
            ...subject.modules.flatMap((module) => [
              ...module.tests,
              ...module.folders.flatMap((folder) => folder.tests),
            ]),
          ].filter(isOut);
          const submitted = tests.reduce((sum, test) => sum + test.submitted, 0);
          const eligible = tests.reduce((sum, test) => sum + test.eligible, 0);
          const average = weightedAverage(tests);
          const taken = eligible ? percent(submitted, eligible) : null;
          return (
            <li key={subject.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  {track === 'domain' ? (
                    <BriefcaseBusiness className="text-brand-600 size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <MessagesSquare className="size-3.5 shrink-0 text-violet-600" aria-hidden />
                  )}
                  <span className="truncate font-medium" title={subject.name}>
                    {subject.name}
                  </span>
                </span>
                <span className={cn('shrink-0 font-bold tabular-nums', scoreTone(average))}>
                  {average === null ? '—' : `${average}%`}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bar-fill h-full rounded-full"
                  style={{ width: `${average ?? 0}%`, background: scoreFill(average) }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {tests.length} tests · {taken === null ? '—' : `${taken}%`} taken
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A subject's modules as a grid: the first rows, the rest behind Show All. */
function ModuleGrid({ modules }: { modules: SyllabusModule[] }) {
  const [all, setAll] = useState(false);
  const FIRST = 6;
  const sorted = [...modules].sort((a, b) =>
    tidy(a.name).localeCompare(tidy(b.name), undefined, { numeric: true })
  );
  const shown = all ? sorted : sorted.slice(0, FIRST);
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
                  <p className="truncate text-sm font-semibold" title={tidy(module.name)}>
                    {tidy(module.name)}
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
          {all ? 'Show Fewer' : `Show All ${modules.length} Modules`}
        </button>
      )}
    </>
  );
}

// --- PRIME domain, and communication and aptitude ------------------------------------------

function TrackTab({
  data,
  track,
  onOpen,
  choice,
  onChoice,
}: {
  data: CampusDetail;
  track: Track;
  onOpen: (test: CampusTest) => void;
  choice: PeriodChoice;
  onChoice: (next: PeriodChoice) => void;
}) {
  const subjects = data.subjects.filter((subject) => trackOf(subject.name) === track);
  const all = testsOf(data, track);
  const keep = (test: CampusTest) => inPeriod(test.released_at, test.name, choice);
  const shown = all.filter(keep).length;

  if (!all.length) {
    return (
      <Empty title={`No ${TRACKS[track].label} Tests Yet`}>
        Tests from {TRACKS[track].note} appear here once they are set up for this campus.
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => {
          const tests = [
            ...data.subjectTests.filter((test) => sameSubject(test.subject, subject.key)),
            ...subject.modules.flatMap((module) => [
              ...module.tests,
              ...module.folders.flatMap((folder) => folder.tests),
            ]),
          ];
          const out = tests.filter(isOut);
          const submitted = out.reduce((sum, test) => sum + test.submitted, 0);
          const eligible = out.reduce((sum, test) => sum + test.eligible, 0);
          const average = weightedAverage(tests);
          const participation = eligible ? percent(submitted, eligible) : null;
          const started = subject.modules.filter((module) => module.started).length;
          return (
            <div key={subject.key} className={cn(panel, 'hover-lift p-5')}>
              <p className="truncate font-bold" title={subject.name}>
                {subject.name}
              </p>
              <p className="text-xs text-slate-500">
                {out.length} of {tests.length} tests released · {started} of{' '}
                {subject.modules.length} modules started
              </p>
              <div className="mt-4 flex items-center gap-5">
                {[
                  { label: 'Average', value: average, icon: Target },
                  { label: 'Taken', value: participation, icon: Users },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex flex-col items-center">
                    <AnimatedRing
                      value={value}
                      size={56}
                      color={(shown) => scoreFill(value === null ? null : shown)}
                    />
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                      <Icon className="size-3" aria-hidden />
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <PeriodFilter
        dates={all.map((test) => test.released_at)}
        choice={choice}
        onChange={onChoice}
        shown={shown}
        total={all.length}
      />
      {!shown && (
        <p className={cn(panel, 'p-5 text-sm text-slate-500')}>
          Nothing in this period. Pick another year or term, or clear the filter.
        </p>
      )}

      {subjects.map((subject) => {
        const subjectTests = data.subjectTests.filter(
          (test) => sameSubject(test.subject, subject.key) && keep(test)
        );
        const modules = [...subject.modules]
          .filter((module) => module.total > 0)
          .sort((a, b) => tidy(a.name).localeCompare(tidy(b.name), undefined, { numeric: true }));
        return (
          <section key={subject.key} className="space-y-2">
            <h2 className="flex items-center gap-2 pt-2 text-lg font-bold">
              <FolderTree className="text-brand-700 dark:text-brand-300 size-4.5" aria-hidden />
              {subject.name}
            </h2>
            {subjectTests.length > 0 && (
              <div className={cn(panel, 'overflow-hidden')}>
                <p className="bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-600">
                  Subject Tests
                </p>
                <TestTable tests={subjectTests} onOpen={onOpen} />
              </div>
            )}
            {modules.map((module) => {
              const tests = module.tests.filter(keep);
              const folders = module.folders
                .map((folder) => ({ ...folder, tests: folder.tests.filter(keep) }))
                .filter((folder) => folder.tests.length);
              if (!tests.length && !folders.length) return null;
              const average = weightedAverage([
                ...tests,
                ...folders.flatMap((folder) => folder.tests),
              ]);
              return (
                <details
                  key={module.name}
                  open={Boolean(choice.year || choice.term || choice.q)}
                  className={cn(panel, 'group overflow-hidden')}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-slate-50">
                    <ChevronRight
                      className="size-4 shrink-0 text-slate-400 transition group-open:rotate-90"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{tidy(module.name)}</span>
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
            })}
          </section>
        );
      })}
    </div>
  );
}

function TestTable({ tests, onOpen }: { tests: CampusTest[]; onOpen: (test: CampusTest) => void }) {
  const sorted = [...tests].sort((a, b) =>
    (b.released_at ?? '').localeCompare(a.released_at ?? '')
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <tbody>
          {sorted.map((test) => {
            const out = isOut(test);
            const participation = percent(test.submitted, test.eligible);
            return (
              <tr
                key={test.ids.join(',')}
                onClick={out ? () => onOpen(test) : undefined}
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
                <td className="w-28 px-3 py-2.5 text-xs whitespace-nowrap text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3 text-slate-400" aria-hidden />
                    {test.status === 'unscheduled' ? '—' : lmsDate(test.released_at)}
                  </span>
                </td>
                <td className="w-36 px-3 py-2.5">
                  {out && (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${participation}%`,
                            backgroundColor: scoreFill(participation),
                          }}
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
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Students -----------------------------------------------------------------------------

function StudentsTab({ campus, batch }: { campus: string; batch?: string }) {
  const students = useStudents();
  const metrics = useStudentMetrics();
  const [sort, setSort] = useState<SortKey>('name');
  const rows = useMemo(
    () =>
      sortRows(
        (students.data?.students ?? [])
          .filter((student) => student.campus === campus && inBatch(student, batch))
          .map((student) => toRow(student, metrics.data?.students[student.slug])),
        sort
      ),
    [students.data, metrics.data, campus, batch, sort]
  );
  if (students.isPending) return <PageLoader variant="table" label="Loading students" />;
  return (
    <StudentTable
      rows={rows}
      sort={sort}
      onSort={setSort}
      showCampus={false}
      empty="No students at this campus for this batch."
    />
  );
}
