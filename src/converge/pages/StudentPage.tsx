import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  Award,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Folder,
  FolderTree,
  GraduationCap,
  MessagesSquare,
  NotebookPen,
  Target,
  TrendingUp,
} from 'lucide-react';

import { StudentExams } from '@/components/assessments/ExamsSection';
import { AnimatedRing } from '@/components/common/AnimatedRing';
import { Avatar } from '@/components/common/Avatar';
import { CampusLogo } from '@/components/common/CampusLogo';
import { InlineLoader, PageLoader } from '@/components/common/PageLoader';
import { StatusTags } from '@/components/students/StatusTags';
import { useStudents } from '@/hooks/useStudents';
import {
  lmsDate,
  percent,
  scoreFill,
  scoreTone,
  useCampusOverview,
  useStudentAssessments,
  type AmcatSitting,
  type StudentAssessmentsData,
  type StudentTest,
} from '@/lib/assessments';
import { cohortLabel } from '@/lib/cohorts';
import { chartColors, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { PlacementCard } from '@/components/students/PlacementCard';

import { CategoryChip, StatusChip, tidy } from '../components/chips';
import {
  CohortBadge,
  Empty,
  Hero,
  HeroStat,
  Kpi,
  Problem,
  SectionTitle,
  Tabs,
  heroGrid,
  panel,
} from '../components/ui';
import { mean } from '../lib/rows';
import { TRACKS, isSuper100, trackOf, type Track } from '../lib/subjects';
import { attendanceFill, attendanceTone } from '../lib/tones';
import { Link, useRouteParams, useRouteSearch, useSetSearch } from '../nav';
import type { StudentSearch, StudentView } from '../routes';

const TABS: { id: StudentView; label: string; icon: typeof Award }[] = [
  { id: 'domain', label: TRACKS.domain.label, icon: BriefcaseBusiness },
  { id: 'elq', label: TRACKS.elq.label, icon: MessagesSquare },
  { id: 'amcat', label: 'AMCAT', icon: Award },
  { id: 'exams', label: 'Internal Exams', icon: NotebookPen },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
];

const isOut = (test: StudentTest) => test.status === 'completed' || test.status === 'live';

/** Average score of submitted tests, %. */
const averageOf = (tests: StudentTest[]) =>
  mean(tests.filter((test) => test.submitted).map((test) => test.pct));

/** Average section score of each AMCAT sitting, oldest first. */
function amcatScores(amcat: AmcatSitting[]) {
  return [...amcat]
    .sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? ''))
    .map((sitting) => mean(sitting.sections.map((section) => section.score)))
    .filter((score): score is number => score !== null);
}

const tooltipStyle = (colors: ReturnType<typeof chartColors>) => ({
  background: colors.tooltip,
  border: `1px solid ${colors.grid}`,
  borderRadius: 12,
  color: colors.text,
  fontSize: 12,
});

/** One student: profile, PRIME domain, communication and aptitude, AMCAT, exams, attendance. */
export default function StudentPage() {
  const { slug = '' } = useRouteParams();
  const { view = 'domain' } = useRouteSearch<StudentSearch>();
  const setSearch = useSetSearch<StudentSearch>();
  const students = useStudents();
  const record = useStudentAssessments(slug);
  const campuses = useCampusOverview();

  const student = students.data?.students.find((entry) => entry.slug === slug);
  const campus = campuses.data?.campuses.find((entry) => entry.name === student?.campus);

  if (!student) {
    if (students.isPending) return <PageLoader variant="profile" label="Loading the student" />;
    if (students.isError) return <Problem message={students.error.message} />;
    return (
      <Empty title="Student Not Found">
        The link may be out of date, or the student is not at one of your campuses.{' '}
        <Link to="/" className="text-brand-700 dark:text-brand-300 font-semibold hover:underline">
          Back to All Students
        </Link>
      </Empty>
    );
  }

  const data = record.data;
  const tests = data?.tests ?? [];
  const domain = tests.filter((test) => trackOf(test.subject) === 'domain');
  const elq = tests.filter((test) => trackOf(test.subject) === 'elq');
  const attended = (data?.attendance.subjects ?? []).reduce(
    (sum, subject) => ({
      sessions: sum.sessions + subject.sessions,
      present: sum.present + subject.present,
    }),
    { sessions: 0, present: 0 }
  );
  const amcat = data ? amcatScores(data.amcat) : [];
  const examAvg = mean(
    (data?.exams ?? [])
      .filter((exam) => exam.kind === 'other')
      .map((exam) => (exam.pct === null ? null : Math.min(100, exam.pct)))
  );
  const trend = (list: StudentTest[]) =>
    [...list]
      .filter((test) => test.submitted && test.pct !== null)
      .sort((a, b) => (a.released_at ?? '').localeCompare(b.released_at ?? ''))
      .map((test) => test.pct);

  return (
    <div className="rise-stagger space-y-5">
      <Link
        to="/"
        className="text-brand-700 dark:text-brand-300 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All Students
      </Link>

      <Hero
        eyebrow={isSuper100(student) ? 'Super 100 Student' : 'Student'}
        title={
          <span className="flex items-center gap-3">
            <Avatar
              name={student.name}
              className="size-12 text-base ring-2 ring-[#e9c27a]/70 sm:size-14"
            />
            <span className="min-w-0">
              <span className="block break-words">{student.name}</span>
              <span className="text-brand-100 mt-0.5 flex flex-wrap items-center gap-x-2 text-sm font-medium">
                {campus ? (
                  <Link
                    to="/campuses/$id"
                    params={{ id: String(campus.id) }}
                    className="inline-flex items-center gap-1.5 hover:text-white hover:underline"
                  >
                    <CampusLogo
                      name={campus.name}
                      logo={campus.logo}
                      className="size-5 rounded-md"
                    />
                    {student.campus}
                  </Link>
                ) : (
                  student.campus
                )}
                <span aria-hidden>·</span>
                <span>{cohortLabel(student.course, student.batch)}</span>
              </span>
            </span>
          </span>
        }
      >
        {(student.cohorts?.length || student.status) && (
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            {student.cohorts?.map((cohort) => <CohortBadge key={cohort} cohort={cohort} onDark />)}
            <StatusTags status={student.status} size="md" />
          </div>
        )}

        <dl className={cn(heroGrid, 'mt-5')}>
          <HeroStat
            icon={BriefcaseBusiness}
            label={TRACKS.domain.label}
            value={data ? averageOf(domain) : null}
            suffix="%"
            trend={trend(domain).slice(-10)}
          />
          <HeroStat
            icon={MessagesSquare}
            label={TRACKS.elq.short}
            value={data ? averageOf(elq) : null}
            suffix="%"
            trend={trend(elq).slice(-10)}
          />
          <HeroStat
            icon={Award}
            label="AMCAT"
            value={amcat.length ? amcat[amcat.length - 1] : null}
            note={
              amcat.length ? `${amcat.length} sitting${amcat.length === 1 ? '' : 's'}` : undefined
            }
            trend={amcat}
          />
          <HeroStat
            icon={CalendarCheck}
            label="Attendance"
            value={attended.sessions ? percent(attended.present, attended.sessions) : null}
            suffix="%"
            trend={data?.attendance.weeks.slice(-10).map((week) => week.pct)}
          />
          <HeroStat icon={NotebookPen} label="Internal Exams" value={examAvg} suffix="%" />
        </dl>
      </Hero>

      <PlacementCard placements={data?.placements} />

      <Tabs
        tabs={TABS.map((tab) => ({
          ...tab,
          count:
            tab.id === 'domain'
              ? domain.filter(isOut).length
              : tab.id === 'elq'
                ? elq.filter(isOut).length
                : tab.id === 'amcat'
                  ? data?.amcat.length
                  : undefined,
        }))}
        value={view}
        onChange={(next) => setSearch({ view: next === 'domain' ? undefined : next })}
        label="Student sections"
      />

      {record.isPending ? (
        <div className={panel}>
          <InlineLoader label="Loading tests, exams, attendance and AMCAT" />
        </div>
      ) : record.isError ? (
        <Problem message={record.error.message} onRetry={() => record.refetch()} />
      ) : (
        <div className="animate-rise space-y-5" key={view}>
          {(view === 'domain' || view === 'elq') && (
            <TrackSection track={view} tests={view === 'domain' ? domain : elq} data={data!} />
          )}
          {view === 'amcat' && <AmcatSection amcat={data!.amcat} />}
          {view === 'exams' &&
            (data!.exams.length ? (
              <StudentExams exams={data!.exams} />
            ) : (
              <Empty title="No Internal Exam Marks Yet">
                Midterm and end-term marks appear here once the LMS has them.
              </Empty>
            ))}
          {view === 'attendance' && <AttendanceSection data={data!} />}
        </div>
      )}
    </div>
  );
}

// --- PRIME domain, and communication and aptitude ------------------------------------------

function TrackSection({
  track,
  tests,
  data,
}: {
  track: Track;
  tests: StudentTest[];
  data: StudentAssessmentsData;
}) {
  const colors = chartColors(useTheme());
  const released = tests.filter(isOut);
  const submitted = released.filter((test) => test.submitted);
  const average = averageOf(released);
  const classAverage = mean(submitted.map((test) => test.class_avg_pct));
  const gap = average !== null && classAverage !== null ? average - classAverage : null;
  const upcoming = tests
    .filter((test) => !test.submitted && (test.status === 'live' || test.status === 'scheduled'))
    .sort((a, b) =>
      (a.due_at ?? a.released_at ?? '').localeCompare(b.due_at ?? b.released_at ?? '')
    );
  const points = useMemo(
    () =>
      [...tests]
        .filter((test) => test.submitted && test.pct !== null)
        .sort((a, b) => (a.released_at ?? '').localeCompare(b.released_at ?? ''))
        .map((test) => ({
          name: test.name,
          date: lmsDate(test.released_at).replace(/ \d{4}$/, ''),
          student: test.pct,
          class: test.class_avg_pct,
        })),
    [tests]
  );
  const subjects = [...new Set(released.map((test) => test.subject ?? 'Other'))].sort();

  if (!tests.length) {
    return (
      <Empty title={`No ${TRACKS[track].label} Tests Yet`}>
        Tests from {TRACKS[track].note} appear here once they are released to this student&rsquo;s
        sections.
      </Empty>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={BookOpenCheck}
          label="Tests Released"
          value={String(released.length)}
          hint={
            upcoming.length ? `${upcoming.length} live or upcoming` : `${subjects.length} subjects`
          }
          accent="#0f5951"
        />
        <Kpi
          icon={ClipboardCheck}
          label="Submitted"
          value={`${submitted.length} of ${released.length}`}
          hint={`${percent(submitted.length, released.length)}% participation`}
          tone={scoreTone(percent(submitted.length, released.length))}
          accent={scoreFill(percent(submitted.length, released.length))}
        />
        <Kpi
          icon={Target}
          label="Average Score"
          value={average === null ? '—' : `${average}%`}
          tone={scoreTone(average)}
          trend={points.slice(-12).map((point) => point.student)}
          accent={scoreFill(average)}
        />
        <Kpi
          icon={TrendingUp}
          label="Versus Class"
          value={gap === null ? '—' : `${gap >= 0 ? '+' : ''}${gap} pts`}
          hint={classAverage === null ? undefined : `Class average ${classAverage}%`}
          tone={gap === null ? undefined : gap >= 0 ? 'text-emerald-600' : 'text-red-600'}
          accent="#c8913a"
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => {
          const here = released.filter((test) => (test.subject ?? 'Other') === subject);
          const done = here.filter((test) => test.submitted);
          const score = averageOf(here);
          const classScore = mean(done.map((test) => test.class_avg_pct));
          return (
            <div key={subject} className={cn(panel, 'hover-lift flex items-center gap-4 p-4')}>
              <AnimatedRing
                value={score}
                size={64}
                color={(shown) => scoreFill(score === null ? null : shown)}
              />
              <div className="min-w-0">
                <p className="truncate font-semibold" title={subject}>
                  {subject}
                </p>
                <p className="text-xs text-slate-500">
                  {done.length} of {here.length} submitted
                </p>
                <p className="text-xs text-slate-500">
                  Class average {classScore === null ? '—' : `${classScore}%`}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {points.length > 1 && (
        <section className={cn(panel, 'p-5')}>
          <SectionTitle
            icon={TrendingUp}
            title="Score Trend"
            description="Each submitted test, against the class average."
          />
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: colors.tick }}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: colors.tick }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle(colors)}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
                  formatter={(value, key) => [
                    `${value}%`,
                    key === 'student' ? 'Student' : 'Class average',
                  ]}
                />
                <Legend
                  formatter={(key) => (key === 'student' ? 'Student' : 'Class average')}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="class"
                  isAnimationActive={false}
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="student"
                  isAnimationActive={false}
                  stroke={track === 'domain' ? '#3863a0' : '#8b5cf6'}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className={cn(panel, 'p-5')}>
          <SectionTitle title="Live and Upcoming" aside="Not submitted yet" />
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {upcoming.map((test) => (
              <li
                key={test.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{test.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[test.subject, test.module && tidy(test.module)].filter(Boolean).join(' › ')}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <StatusChip status={test.status} />
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {test.status === 'live'
                      ? `Due ${lmsDate(test.due_at, true)}`
                      : `Opens ${lmsDate(test.released_at, true)}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {subjects.map((subject) => (
        <SubjectTests
          key={subject}
          subject={subject}
          tests={released.filter((test) => (test.subject ?? 'Other') === subject)}
          syncedAt={data.syncedAt}
        />
      ))}
    </>
  );
}

/** One subject's released tests: those on the subject itself, then module by module. */
function SubjectTests({
  subject,
  tests,
  syncedAt,
}: {
  subject: string;
  tests: StudentTest[];
  syncedAt: string | null;
}) {
  const subjectLevel = tests.filter((test) => !test.module);
  // module > sub-folder ('' = tests on the module itself) > tests
  const modules = [
    ...tests
      .filter((test) => test.module)
      .reduce((tree, test) => {
        const key = tidy(test.module!);
        const folders = tree.get(key) ?? new Map<string, StudentTest[]>();
        folders.set(test.lecture ?? '', [...(folders.get(test.lecture ?? '') ?? []), test]);
        return tree.set(key, folders);
      }, new Map<string, Map<string, StudentTest[]>>())
      .entries(),
  ].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <section className={cn(panel, 'overflow-hidden')}>
      <div className="px-5 pt-4 pb-3">
        <SectionTitle
          icon={FolderTree}
          title={subject}
          description={`${tests.length} tests released · ${modules.length} modules`}
          aside={syncedAt && `From the LMS · ${lmsDate(syncedAt, true)}`}
        />
      </div>
      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {subjectLevel.length > 0 && (
          <div>
            <p className="bg-slate-50 px-5 py-1.5 text-xs font-semibold text-slate-600">
              Subject Tests
            </p>
            <ResultsTable tests={subjectLevel} showRank />
          </div>
        )}
        {modules.map(([module, folders]) => {
          const all = [...folders.values()].flat();
          const done = all.filter((test) => test.submitted);
          const average = averageOf(all);
          return (
            <details key={module} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <ChevronRight
                  className="size-4 shrink-0 text-slate-400 transition group-open:rotate-90"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{module}</span>
                  <span className="block text-xs text-slate-500">
                    {done.length} of {all.length} submitted
                  </span>
                </span>
                <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${average ?? 0}%`, background: scoreFill(average) }}
                  />
                </span>
                <span
                  className={cn(
                    'w-12 text-right text-sm font-bold tabular-nums',
                    scoreTone(average)
                  )}
                >
                  {average === null ? '—' : `${average}%`}
                </span>
              </summary>
              {[...folders.entries()].map(([folder, list]) => (
                <div key={folder}>
                  {folder && (
                    <p className="flex items-center gap-2 bg-slate-50 px-5 py-1.5 text-xs font-semibold text-slate-600">
                      <Folder className="size-3.5" aria-hidden />
                      {folder}
                    </p>
                  )}
                  <ResultsTable tests={list} />
                </div>
              ))}
            </details>
          );
        })}
      </div>
    </section>
  );
}

function ResultsTable({ tests, showRank = false }: { tests: StudentTest[]; showRank?: boolean }) {
  const sorted = [...tests].sort((a, b) =>
    (b.released_at ?? '').localeCompare(a.released_at ?? '')
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {sorted.map((test) => (
            <tr key={test.id} className="border-b border-dotted border-slate-200 last:border-0">
              <td className="px-5 py-2.5">
                <p className="font-medium">{test.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <CategoryChip category={test.category} />
                  {test.status === 'live' && <StatusChip status="live" />}
                  <span>Released {lmsDate(test.released_at)}</span>
                </p>
              </td>
              {showRank && (
                <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap text-slate-600">
                  {test.rank ? (
                    <>
                      <span className="text-sm font-bold text-slate-800">#{test.rank}</span> of{' '}
                      {test.takers}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              )}
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                {test.submitted ? (
                  <>
                    <span className={cn('font-bold tabular-nums', scoreTone(test.pct))}>
                      {test.pct ?? '—'}%
                    </span>
                    <span className="block text-xs text-slate-500 tabular-nums">
                      {Number(test.marks ?? 0)} / {Number(test.max_marks ?? 0)}
                    </span>
                  </>
                ) : (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    {test.status === 'live' ? 'Pending' : 'Not Submitted'}
                  </span>
                )}
              </td>
              <td className="w-24 px-5 py-2.5 text-right text-xs text-slate-500 tabular-nums">
                Class {test.class_avg_pct === null ? '—' : `${test.class_avg_pct}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- AMCAT -------------------------------------------------------------------------------

const AMCAT_COLORS = ['#0f5951', '#c8913a', '#10b981', '#8b5cf6', '#ef4444', '#0ea5e9', '#64748b'];

function AmcatSection({ amcat }: { amcat: AmcatSitting[] }) {
  const colors = chartColors(useTheme());
  if (!amcat.length) {
    return (
      <Empty title="No AMCAT Sittings Yet">AMCAT results appear here after each sitting.</Empty>
    );
  }
  const sittings = [...amcat].sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? ''));
  const sections = [
    ...new Set(sittings.flatMap((sitting) => sitting.sections.map((part) => part.name))),
  ];
  const points = sittings.map((sitting) => ({
    label: lmsDate(sitting.taken_at),
    Overall: mean(sitting.sections.map((part) => part.score)),
    ...Object.fromEntries(sitting.sections.map((part) => [part.name, part.score])),
  }));

  return (
    <>
      {points.length > 1 && (
        <section className={cn(panel, 'p-5')}>
          <SectionTitle
            icon={TrendingUp}
            title="AMCAT Progress"
            description="Each section across sittings, out of 100; overall is the average of the sections."
          />
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: colors.tick }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: colors.tick }}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle(colors)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="Overall"
                  stroke={colors.text}
                  strokeWidth={3}
                  dot={{ r: 3.5 }}
                  connectNulls
                  isAnimationActive={false}
                />
                {sections.map((name, index) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={AMCAT_COLORS[index % AMCAT_COLORS.length]}
                    strokeWidth={1.5}
                    strokeOpacity={0.75}
                    dot={{ r: 2.5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {[...sittings].reverse().map((sitting) => (
          <AmcatCard key={sitting.id} sitting={sitting} />
        ))}
      </div>
    </>
  );
}

function AmcatCard({ sitting }: { sitting: AmcatSitting }) {
  const overall = mean(sitting.sections.map((section) => section.score));
  return (
    <article className={cn(panel, 'p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold" title={sitting.test_name}>
            {sitting.test_name}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarDays className="size-3.5" aria-hidden />
            {lmsDate(sitting.taken_at, true)}
            {sitting.status && <span>· {sitting.status}</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <AnimatedRing
            value={overall}
            size={56}
            suffix=""
            color={(shown) => scoreFill(overall === null ? null : shown)}
          />
          <span className="mt-0.5 text-[10px] font-medium text-slate-500">Overall</span>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {sitting.sections.map((section) => {
          const pct = section.score === null ? null : percent(section.score, section.total ?? 100);
          return (
            <li key={section.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{section.name}</span>
                <span className={cn('font-semibold tabular-nums', scoreTone(pct))}>
                  {section.score === null
                    ? 'Not Taken'
                    : `${section.score} / ${section.total ?? 100}`}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bar-fill h-full rounded-full"
                  style={{ width: `${pct ?? 0}%`, backgroundColor: scoreFill(pct) }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

// --- Attendance --------------------------------------------------------------------------

function AttendanceSection({ data }: { data: StudentAssessmentsData }) {
  const colors = chartColors(useTheme());
  const { subjects, weeks } = data.attendance;
  if (!subjects.length) {
    return <Empty title="No Attendance Yet">Classes appear here once the LMS records them.</Empty>;
  }
  const sum = (list: typeof subjects) =>
    list.reduce(
      (total, subject) => ({
        sessions: total.sessions + subject.sessions,
        present: total.present + subject.present,
      }),
      { sessions: 0, present: 0 }
    );
  const all = sum(subjects);
  const prime = sum(subjects.filter((subject) => subject.prime));
  const recent = weeks.slice(-4).reduce(
    (total, week) => ({
      sessions: total.sessions + week.sessions,
      present: total.present + week.present,
    }),
    { sessions: 0, present: 0 }
  );
  const pct = (part: { sessions: number; present: number }) =>
    part.sessions ? percent(part.present, part.sessions) : null;
  const low = subjects.filter((subject) => (subject.pct ?? 0) < 75).length;
  const groups = [
    { title: 'PRIME Classes', list: subjects.filter((subject) => subject.prime) },
    { title: 'Other Classes', list: subjects.filter((subject) => !subject.prime) },
  ].filter((group) => group.list.length);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={CalendarCheck}
          label="All Classes"
          value={pct(all) === null ? '—' : `${pct(all)}%`}
          hint={`${all.present} of ${all.sessions} classes`}
          tone={attendanceTone(pct(all))}
          trend={weeks.slice(-10).map((week) => week.pct)}
          accent={attendanceFill(pct(all))}
        />
        <Kpi
          icon={GraduationCap}
          label="PRIME Classes"
          value={pct(prime) === null ? '—' : `${pct(prime)}%`}
          hint={`${prime.present} of ${prime.sessions} classes`}
          tone={attendanceTone(pct(prime))}
          accent={attendanceFill(pct(prime))}
        />
        <Kpi
          icon={CalendarDays}
          label="Last 4 Weeks"
          value={pct(recent) === null ? '—' : `${pct(recent)}%`}
          hint="Recent attendance"
          tone={attendanceTone(pct(recent))}
          accent={attendanceFill(pct(recent))}
        />
        <Kpi
          icon={BookOpenCheck}
          label="Subjects"
          value={String(subjects.length)}
          hint={low ? `${low} below 75%` : 'All at 75% or more'}
          tone={low ? 'text-amber-600' : undefined}
          accent="#c8913a"
        />
      </div>

      <section className={cn(panel, 'p-5')}>
        <SectionTitle
          icon={CalendarCheck}
          title="Week by Week"
          description="Share of classes attended each week, since 1 July."
        />
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={weeks.map((week) => ({
                ...week,
                label: lmsDate(week.week).replace(/ \d{4}$/, ''),
              }))}
              margin={{ top: 8, right: 8, bottom: 0, left: -24 }}
            >
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: colors.tick }} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: colors.tick }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle(colors)}
                labelFormatter={(label) => `Week of ${label}`}
                formatter={(value, _key, item) => [
                  `${value}% (${item.payload.present}/${item.payload.sessions})`,
                  'Attended',
                ]}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 2.5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className={cn(panel, 'self-start p-5')}>
            <SectionTitle title={`By Subject: ${group.title}`} />
            <ul className="mt-3 space-y-3">
              {group.list.map((subject) => (
                <li key={subject.subject}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium" title={subject.subject}>
                      {subject.subject}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                      <span className={cn('text-sm font-bold', attendanceTone(subject.pct))}>
                        {subject.pct ?? '—'}%
                      </span>{' '}
                      · {subject.present}/{subject.sessions}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="bar-fill h-full rounded-full"
                      style={{
                        width: `${subject.pct ?? 0}%`,
                        backgroundColor: attendanceFill(subject.pct),
                      }}
                    />
                  </div>
                  {subject.last_date && (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Last class {lmsDate(subject.last_date)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Attendance by faculty is on the campus page; the LMS records a student&rsquo;s attendance by
        subject.
      </p>
    </>
  );
}
