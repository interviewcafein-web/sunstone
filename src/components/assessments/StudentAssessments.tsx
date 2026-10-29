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
  Award,
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  ChevronRight,
  ClipboardCheck,
  Folder,
  FolderTree,
  Target,
  TrendingUp,
} from 'lucide-react';

import { attendanceFill, attendanceTone } from '@/components/assessments/CampusInsights';
import { StudentExams } from '@/components/assessments/ExamsSection';
import { Sparkline, TrendDelta } from '@/components/common/Sparkline';
import { Card, CardHeader } from '@/components/coding/ui';
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  lmsDate,
  percent,
  scoreFill,
  scoreTone,
  useStudentAssessments,
  type AmcatSitting,
  type StudentTest,
  type TestStatus,
} from '@/lib/assessments';
import { chartColors, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { InlineLoader } from '@/components/common/PageLoader';

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  trend,
}: {
  icon: typeof Award;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  /** Oldest first: weeks, tests or sittings. */
  trend?: (number | null)[];
}) {
  return (
    <div className="shadow-card bg-surface hover-lift rounded-2xl border border-slate-200 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className="size-3.5" aria-hidden />
        {label}
        {trend && <TrendDelta values={trend} className="ml-auto" />}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className={cn('text-2xl font-bold tabular-nums', tone)}>{value}</p>
        {trend && <Sparkline values={trend} width={72} height={24} />}
      </div>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** A student's Sunstone PRIME domain tests and AMCAT results. Staff only. */
export type StudentSection = 'tests' | 'exams' | 'amcat' | 'attendance';

/**
 * One student's LMS record, one section at a time: PRIME tests, internal exams, AMCAT or
 * attendance. Every section shares one request (cached), so switching is instant.
 */
export function StudentAssessments({
  username,
  section = 'tests',
}: {
  username: string;
  section?: StudentSection;
}) {
  const query = useStudentAssessments(username);
  const colors = chartColors(useTheme());

  const trend = useMemo(
    () =>
      [...(query.data?.tests ?? [])]
        .filter((test) => test.submitted && test.pct !== null)
        .sort((a, b) => (a.released_at ?? '').localeCompare(b.released_at ?? ''))
        .map((test) => ({
          name: test.name,
          date: lmsDate(test.released_at),
          student: test.pct,
          class: test.class_avg_pct,
        })),
    [query.data]
  );

  if (query.isPending) {
    return (
      <Card>
        <InlineLoader label="Loading tests, attendance and AMCAT" />
      </Card>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <p className="text-sm text-red-700">{query.error.message}</p>
      </Card>
    );
  }

  const { tests, amcat, attendance, exams, syncedAt } = query.data;
  const attended = attendance.subjects.reduce(
    (sum, subject) => ({
      sessions: sum.sessions + subject.sessions,
      present: sum.present + subject.present,
      primeSessions: sum.primeSessions + (subject.prime ? subject.sessions : 0),
      primePresent: sum.primePresent + (subject.prime ? subject.present : 0),
    }),
    { sessions: 0, present: 0, primeSessions: 0, primePresent: 0 }
  );
  const attendancePct = attended.sessions ? percent(attended.present, attended.sessions) : null;
  const primeAttendance = attended.primeSessions
    ? percent(attended.primePresent, attended.primeSessions)
    : null;
  const recent = attendance.weeks.slice(-4);
  const recentSessions = recent.reduce((sum, week) => sum + week.sessions, 0);
  const lastWeeks = recentSessions
    ? percent(
        recent.reduce((sum, week) => sum + week.present, 0),
        recentSessions
      )
    : null;
  const lowSubjects = attendance.subjects.filter((subject) => (subject.pct ?? 0) < 75).length;
  const submitted = tests.filter((test) => test.submitted);
  const average = submitted.length
    ? Math.round(submitted.reduce((sum, test) => sum + (test.pct ?? 0), 0) / submitted.length)
    : null;
  const classAverages = submitted.filter((test) => test.class_avg_pct !== null);
  const classAverage = classAverages.length
    ? Math.round(
        classAverages.reduce((sum, test) => sum + (test.class_avg_pct ?? 0), 0) /
          classAverages.length
      )
    : null;
  const gap = average !== null && classAverage !== null ? average - classAverage : null;

  // Average section score of each AMCAT sitting, oldest first.
  const amcatScores = [...amcat]
    .sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? ''))
    .map((sitting) => {
      const scores = sitting.sections
        .map((section) => section.score)
        .filter((score): score is number => typeof score === 'number');
      return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    })
    .filter((score): score is number => score !== null);

  // Each AMCAT section's score per sitting, for the progress chart.
  const amcatSeries = (() => {
    const sittings = [...amcat].sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? ''));
    const sections = [
      ...new Set(sittings.flatMap((sitting) => sitting.sections.map((part) => part.name))),
    ];
    const points = sittings.map((sitting) => ({
      label: lmsDate(sitting.taken_at).replace(/ \d{4}$/, ''),
      ...Object.fromEntries(sitting.sections.map((part) => [part.name, part.score])),
    }));
    return { sections, points };
  })();

  const released = tests.filter((test) => test.status === 'completed' || test.status === 'live');
  const upcoming = tests
    .filter((test) => !test.submitted && (test.status === 'live' || test.status === 'scheduled'))
    .sort((a, b) =>
      (a.due_at ?? a.released_at ?? '').localeCompare(b.due_at ?? b.released_at ?? '')
    );
  const subjectLevel = released.filter((test) => !test.module);
  // module > sub-folder ('' = tests on the module itself) > tests, in release order
  const modules = [
    ...released
      .filter((test) => test.module)
      .reduce((tree, test) => {
        const folders = tree.get(test.module!) ?? new Map<string, StudentTest[]>();
        folders.set(test.lecture ?? '', [...(folders.get(test.lecture ?? '') ?? []), test]);
        return tree.set(test.module!, folders);
      }, new Map<string, Map<string, StudentTest[]>>())
      .entries(),
  ];

  return (
    <div className="animate-rise space-y-4" key={section}>
      {section !== 'attendance' && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi
            icon={BookOpenCheck}
            label="PRIME Mock Tests released"
            value={String(released.length)}
            hint={upcoming.length ? `${upcoming.length} live or upcoming` : 'Prime Domain Coding'}
          />
          <Kpi
            icon={ClipboardCheck}
            label="Submitted"
            value={`${submitted.length} of ${released.length}`}
            hint={`${percent(submitted.length, released.length)}% participation`}
            tone={scoreTone(percent(submitted.length, released.length))}
          />
          <Kpi
            icon={Target}
            label="Average score"
            value={average === null ? '—' : `${average}%`}
            hint={
              gap === null
                ? undefined
                : `${gap >= 0 ? '+' : ''}${gap} pts vs class average (${classAverage}%)`
            }
            tone={scoreTone(average)}
            trend={trend.map((point) => point.student)}
          />
          <Kpi
            icon={CalendarCheck}
            label="Attendance"
            value={attendancePct === null ? '—' : `${attendancePct}%`}
            hint={primeAttendance === null ? 'All classes' : `PRIME classes ${primeAttendance}%`}
            tone={attendanceTone(attendancePct)}
            trend={attendance.weeks.slice(-10).map((week) => week.pct)}
          />
          <Kpi
            icon={Award}
            label="AMCAT, latest"
            value={amcatScores.length ? String(amcatScores[amcatScores.length - 1]) : '—'}
            hint={
              amcat.length
                ? `${amcat.length} sitting${amcat.length === 1 ? '' : 's'} · ${lmsDate(amcat[0].taken_at)}`
                : 'None yet'
            }
            tone={scoreTone(amcatScores[amcatScores.length - 1])}
            trend={amcatScores}
          />
        </div>
      )}

      {section === 'attendance' && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            icon={CalendarCheck}
            label="All classes"
            value={attendancePct === null ? '—' : `${attendancePct}%`}
            hint={`${attended.present} of ${attended.sessions} classes`}
            tone={attendanceTone(attendancePct)}
            trend={attendance.weeks.slice(-10).map((week) => week.pct)}
          />
          <Kpi
            icon={GraduationCap}
            label="PRIME classes"
            value={primeAttendance === null ? '—' : `${primeAttendance}%`}
            hint={`${attended.primePresent} of ${attended.primeSessions} classes`}
            tone={attendanceTone(primeAttendance)}
          />
          <Kpi
            icon={CalendarDays}
            label="Last 4 weeks"
            value={lastWeeks === null ? '—' : `${lastWeeks}%`}
            hint="Recent attendance"
            tone={attendanceTone(lastWeeks)}
          />
          <Kpi
            icon={BookOpenCheck}
            label="Subjects"
            value={String(attendance.subjects.length)}
            hint={lowSubjects ? `${lowSubjects} below 75%` : 'All at 75% or more'}
            tone={lowSubjects ? 'text-amber-600' : undefined}
          />
        </div>
      )}

      {section === 'attendance' && attendance.subjects.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500">No attendance recorded for this student yet.</p>
        </Card>
      )}

      {section === 'attendance' && attendance.subjects.length > 0 && (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <CalendarCheck className="text-brand-700 dark:text-brand-300 size-4" aria-hidden />
                Attendance
              </span>
            }
            aside={<span className="text-xs text-slate-500">Classes since 1 July</span>}
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={attendance.weeks.map((week) => ({
                    ...week,
                    label: lmsDate(week.week).replace(/ \d{4}$/, ''),
                  }))}
                  margin={{ top: 8, right: 8, bottom: 0, left: -24 }}
                >
                  <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: colors.tick }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: colors.tick }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: colors.tooltip,
                      border: `1px solid ${colors.grid}`,
                      borderRadius: 12,
                      color: colors.text,
                      fontSize: 12,
                    }}
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
            <ul className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {attendance.subjects.map((subject) => (
                <li key={subject.subject}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-medium">
                      {subject.subject}
                      {subject.prime && (
                        <span className="ml-1 text-[10px] font-semibold text-amber-600">PRIME</span>
                      )}
                    </span>
                    <span className="shrink-0 text-slate-500 tabular-nums">
                      <span className={cn('font-bold', attendanceTone(subject.pct))}>
                        {subject.pct}%
                      </span>{' '}
                      · {subject.present}/{subject.sessions}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${subject.pct ?? 0}%`,
                        backgroundColor: attendanceFill(subject.pct),
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {section === 'tests' && trend.length > 1 && (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <TrendingUp className="text-brand-700 dark:text-brand-300 size-4" aria-hidden />
                Score trend
              </span>
            }
            aside={<span className="text-xs text-slate-500">Student vs class average, %</span>}
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.tick }} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: colors.tick }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: colors.tooltip,
                    border: `1px solid ${colors.grid}`,
                    borderRadius: 12,
                    color: colors.text,
                    fontSize: 12,
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
                  formatter={(value, key) => [
                    `${value}%`,
                    key === 'student' ? 'Student' : 'Class avg',
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
                  stroke="#1a3e70"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {section === 'tests' && upcoming.length > 0 && (
        <Card>
          <CardHeader
            title="Live and upcoming"
            aside={<span className="text-xs text-slate-500">Not submitted yet</span>}
          />
          <ul className="grid gap-2 md:grid-cols-2">
            {upcoming.map((test) => (
              <li
                key={test.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{test.name}</span>
                  <span className="block truncate text-xs text-slate-500">{place(test)}</span>
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
        </Card>
      )}

      {section === 'tests' && (
        <>
          <Card className="overflow-hidden p-0">
            <div className="px-5 pt-4">
              <CardHeader
                title="Prime Mock Tests"
                aside={
                  <span className="text-xs text-slate-500">
                    e.g. AMCAT mock tests, with rank in class
                  </span>
                }
              />
            </div>
            {subjectLevel.length ? (
              <ResultsTable tests={subjectLevel} showRank />
            ) : (
              <p className="px-5 pb-5 text-sm text-slate-500">No Prime Mock Tests yet.</p>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="px-5 pt-4">
              <CardHeader
                title="Practice Test and MCQs"
                aside={
                  syncedAt && (
                    <span className="text-xs text-slate-500">
                      From the LMS · {lmsDate(syncedAt, true)}
                    </span>
                  )
                }
              />
            </div>
            {modules.length ? (
              <div className="divide-y divide-slate-200 border-t border-slate-200">
                {modules.map(([module, folders]) => {
                  const all = [...folders.values()].flat();
                  const done = all.filter((test) => test.submitted);
                  const average = done.length
                    ? Math.round(done.reduce((sum, test) => sum + (test.pct ?? 0), 0) / done.length)
                    : null;
                  return (
                    <details key={module} open className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3">
                        <ChevronRight
                          className="size-4 text-slate-400 transition group-open:rotate-90"
                          aria-hidden
                        />
                        <FolderTree
                          className="text-brand-700 dark:text-brand-300 size-4"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{module}</span>
                          <span className="block text-xs text-slate-500">
                            {done.length} of {all.length} submitted
                          </span>
                        </span>
                        <span className={cn('text-sm font-bold tabular-nums', scoreTone(average))}>
                          {average === null ? '' : `${average}%`}
                        </span>
                      </summary>
                      {[...folders.entries()].map(([folder, tests]) => (
                        <div key={folder}>
                          {folder && (
                            <p className="flex items-center gap-2 bg-slate-50 px-5 py-1.5 text-xs font-semibold text-slate-600">
                              <Folder className="size-3.5" aria-hidden />
                              {folder}
                            </p>
                          )}
                          <ResultsTable tests={tests} />
                        </div>
                      ))}
                    </details>
                  );
                })}
              </div>
            ) : (
              <p className="px-5 pb-5 text-sm text-slate-500">
                No practice tests or MCQs have been released to this student's sections yet.
              </p>
            )}
          </Card>
        </>
      )}

      {section === 'exams' &&
        (exams.length ? (
          <StudentExams exams={exams} />
        ) : (
          <Card>
            <p className="text-sm text-slate-500">No internal exam marks for this student yet.</p>
          </Card>
        ))}

      {section === 'amcat' && amcatSeries.points.length > 1 && (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <TrendingUp className="text-brand-700 dark:text-brand-300 size-4" aria-hidden />
                AMCAT progress
              </span>
            }
            aside={
              <span className="text-xs text-slate-500">
                Each section across sittings, out of 100
              </span>
            }
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={amcatSeries.points}
                margin={{ top: 8, right: 12, bottom: 0, left: -18 }}
              >
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
                <Tooltip
                  contentStyle={{
                    background: colors.tooltip,
                    border: `1px solid ${colors.grid}`,
                    borderRadius: 12,
                    color: colors.text,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {amcatSeries.sections.map((name, index) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={AMCAT_COLORS[index % AMCAT_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {section === 'amcat' && (
        <Card>
          <CardHeader
            title="AMCAT"
            aside={<span className="text-xs text-slate-500">Scores out of 100</span>}
          />
          {amcat.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {amcat.map((sitting) => (
                <AmcatCard key={sitting.id} sitting={sitting} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No AMCAT sittings yet.</p>
          )}
        </Card>
      )}
    </div>
  );
}

const place = (test: StudentTest) =>
  [test.module, test.lecture].filter(Boolean).join(' › ') || test.subject || 'Prime Domain Coding';

const AMCAT_COLORS = ['#1a3e70', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#0ea5e9', '#64748b'];

function StatusChip({ status }: { status: TestStatus }) {
  return (
    <span
      className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold', STATUS_STYLES[status])}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function ResultsTable({ tests, showRank = false }: { tests: StudentTest[]; showRank?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {tests.map((test) => (
            <tr key={test.id} className="border-b border-dotted border-slate-200 last:border-0">
              <td className="px-5 py-2.5">
                <p className="font-medium">{test.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px text-[10px] font-semibold',
                      CATEGORY_STYLES[test.category]
                    )}
                  >
                    {CATEGORY_LABELS[test.category]}
                  </span>
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
                    {test.status === 'live' ? 'Pending' : 'Not submitted'}
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

function AmcatCard({ sitting }: { sitting: AmcatSitting }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold" title={sitting.test_name}>
            {sitting.test_name}
          </p>
          <p className="text-xs text-slate-500">{lmsDate(sitting.taken_at)}</p>
        </div>
        {sitting.status && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {sitting.status}
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {sitting.sections.map((section) => {
          const pct = section.score === null ? null : percent(section.score, section.total ?? 100);
          return (
            <li key={section.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{section.name}</span>
                <span className={cn('font-semibold tabular-nums', scoreTone(pct))}>
                  {section.score === null ? 'Not taken' : section.score}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct ?? 0}%`, backgroundColor: scoreFill(pct) }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
