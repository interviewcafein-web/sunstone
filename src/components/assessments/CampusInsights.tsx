import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  CalendarCheck,
  GraduationCap,
  School,
  Target,
  TrendingDown,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';

import {
  lmsDate,
  scoreFill,
  scoreTone,
  type CampusAmcat,
  type CampusAttendance,
  type CampusStudentRow,
} from '@/lib/assessments';
import { chartColors, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';

/** Attendance colour: green from 75%, amber from 60%, red below. */
const attendanceTone = (pct: number | null | undefined) =>
  pct == null
    ? 'text-slate-400'
    : pct >= 75
      ? 'text-emerald-600 dark:text-emerald-400'
      : pct >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
const attendanceFill = (pct: number | null | undefined) =>
  pct == null ? '#cbd5e1' : pct >= 75 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className={cn(panel, 'p-4')}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Bar({ pct, fill }: { pct: number | null; fill: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct ?? 0}%`, backgroundColor: fill }}
      />
    </div>
  );
}

// --- Attendance ---------------------------------------------------------------------------

const SUBJECTS_SHOWN = 12;

export function AttendanceTab({ data }: { data: CampusAttendance }) {
  const colors = chartColors(useTheme());
  const [allSubjects, setAllSubjects] = useState(false);
  const subjects = allSubjects ? data.subjects : data.subjects.slice(0, SUBJECTS_SHOWN);
  const weeks = data.weeks.map((week) => ({
    ...week,
    label: lmsDate(week.week).replace(/ \d{4}$/, ''),
  }));
  if (!data.marks) {
    return (
      <p className={cn(panel, 'p-5 text-sm text-slate-500')}>
        No attendance recorded for this selection yet.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={CalendarCheck}
          label="Attendance, all classes"
          value={`${data.pct ?? '—'}%`}
          tone={attendanceTone(data.pct)}
        />
        <Stat
          icon={GraduationCap}
          label="Attendance, PRIME classes"
          value={data.prime_pct === null ? '—' : `${data.prime_pct}%`}
          tone={attendanceTone(data.prime_pct)}
        />
        <Stat icon={Users} label="Students tracked" value={data.students.toLocaleString('en-IN')} />
        <Stat
          icon={School}
          label="Attendance marks"
          value={data.marks.toLocaleString('en-IN')}
          hint={data.syncedAt ? `Since 1 Jul · updated ${lmsDate(data.syncedAt)}` : undefined}
        />
      </div>

      <section className={cn(panel, 'p-5')}>
        <h2 className="text-lg font-bold">Week by week</h2>
        <p className="text-sm text-slate-500">
          Share of classes attended each week (75% line for reference).
        </p>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeks} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.tick }} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: colors.tick }}
                tickLine={false}
              />
              <ReferenceLine y={75} stroke="#10b981" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{
                  background: colors.tooltip,
                  border: `1px solid ${colors.grid}`,
                  borderRadius: 12,
                  color: colors.text,
                  fontSize: 12,
                }}
                labelFormatter={(label) => `Week of ${label}`}
                formatter={(value) => [`${value}%`, 'Attendance']}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="#1a3e70"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cn(panel, 'self-start p-5')}>
          <h2 className="text-lg font-bold">By subject</h2>
          <ul className="mt-3 space-y-3">
            {subjects.map((subject) => (
              <li key={subject.subject}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {subject.subject}
                    {subject.prime && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        PRIME
                      </span>
                    )}
                  </span>
                  <span
                    className={cn('shrink-0 font-bold tabular-nums', attendanceTone(subject.pct))}
                  >
                    {subject.pct}%
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Bar pct={subject.pct} fill={attendanceFill(subject.pct)} />
                  <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                    {subject.students} students
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {data.subjects.length > SUBJECTS_SHOWN && (
            <button
              type="button"
              onClick={() => setAllSubjects(!allSubjects)}
              className="text-brand-700 dark:text-brand-300 mt-3 text-sm font-semibold hover:underline"
            >
              {allSubjects ? 'Show fewer' : `Show all ${data.subjects.length} subjects`}
            </button>
          )}
        </section>

        <section className={cn(panel, 'overflow-hidden')}>
          <div className="px-5 pt-5">
            <h2 className="text-lg font-bold">By instructor</h2>
            <p className="text-sm text-slate-500">
              Attendance in their classes (whole campus). PRIME instructors first.
            </p>
          </div>
          <div className="mt-3 max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {data.faculty.map((person) => (
                  <tr key={person.faculty_id} className="border-t border-dotted border-slate-200">
                    <td className="px-5 py-2.5">
                      <p className="font-medium">
                        {person.faculty}
                        {person.prime && (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                            PRIME
                          </span>
                        )}
                      </p>
                      <p className="line-clamp-1 text-xs text-slate-500" title={person.subjects}>
                        {person.subjects}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap text-slate-500 tabular-nums">
                      {person.sessions} classes
                    </td>
                    <td className="w-32 px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Bar pct={person.pct} fill={attendanceFill(person.pct)} />
                        <span
                          className={cn(
                            'w-9 text-right text-sm font-bold tabular-nums',
                            attendanceTone(person.pct)
                          )}
                        >
                          {person.pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- AMCAT --------------------------------------------------------------------------------

export function AmcatTab({ data }: { data: CampusAmcat }) {
  if (!data.rounds.length) {
    return (
      <p className={cn(panel, 'p-5 text-sm text-slate-500')}>
        No AMCAT results for this selection yet.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <section className={cn(panel, 'p-5')}>
        <h2 className="text-lg font-bold">AMCAT section averages</h2>
        <p className="text-sm text-slate-500">
          All rounds taken by these students, from the AMCAT platform (scores out of 100).
        </p>
        <ul className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {data.sections.map((section) => (
            <li key={section.name}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{section.name}</span>
                <span className={cn('font-bold tabular-nums', scoreTone(section.avg))}>
                  {section.avg ?? '—'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Bar pct={section.avg} fill={scoreFill(section.avg)} />
                <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                  {section.takers} scores
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {data.rounds.map((round) => (
          <article key={round.test_name} className={cn(panel, 'p-5')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-bold" title={round.test_name}>
                  {round.test_name}
                </h3>
                <p className="text-xs text-slate-500">
                  {lmsDate(round.first_at)}
                  {round.last_at &&
                    lmsDate(round.last_at) !== lmsDate(round.first_at) &&
                    ` – ${lmsDate(round.last_at)}`}
                  {' · '}
                  {round.students} students
                </p>
              </div>
              <span className={cn('text-2xl font-bold tabular-nums', scoreTone(round.avg_score))}>
                {round.avg_score ?? '—'}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {(round.sections ?? []).map((section) => (
                <li key={section.name}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">{section.name}</span>
                    <span className={cn('font-semibold tabular-nums', scoreTone(section.avg))}>
                      {section.avg ?? '—'}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Bar pct={section.avg} fill={scoreFill(section.avg)} />
                  </div>
                </li>
              ))}
            </ul>
            {round.top && round.top.length > 0 && (
              <ol className="mt-4 space-y-1 border-t border-dotted border-slate-200 pt-3 text-sm">
                {round.top.map((student, index) => (
                  <li key={student.username} className="flex items-center gap-2">
                    <span className="w-4 text-xs text-slate-400 tabular-nums">{index + 1}</span>
                    <Link
                      to="/s/$slug"
                      params={{ slug: student.username }}
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      {student.name}
                    </Link>
                    <span className={cn('font-semibold tabular-nums', scoreTone(student.avg))}>
                      {student.avg}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

// --- Insights: attendance against scores ----------------------------------------------------

const ATTENDANCE_OK = 75;
const SCORE_OK = 60;

type Group = 'absent_low' | 'present_low' | 'absent_good' | 'on_track';

const GROUPS: Record<Group, { title: string; who: string; color: string; icon: typeof Users }> = {
  absent_low: {
    title: 'Not attending, scoring low',
    who: 'Follow up with the campus: students are missing classes.',
    color: '#ef4444',
    icon: UserX,
  },
  present_low: {
    title: 'Attending, scoring low',
    who: 'Review teaching with the instructor: students come but do not score.',
    color: '#f59e0b',
    icon: TrendingDown,
  },
  absent_good: {
    title: 'Scoring well, low attendance',
    who: 'Doing well despite missing classes; encourage attendance.',
    color: '#0ea5e9',
    icon: Target,
  },
  on_track: {
    title: 'On track',
    who: 'Attending and scoring well.',
    color: '#10b981',
    icon: UserCheck,
  },
};

const groupOf = (student: CampusStudentRow): Group | null => {
  if (student.attendance_pct == null || student.avg_pct == null) return null;
  const present = student.attendance_pct >= ATTENDANCE_OK;
  const good = student.avg_pct >= SCORE_OK;
  return present ? (good ? 'on_track' : 'present_low') : good ? 'absent_good' : 'absent_low';
};

export function InsightsPanel({ students }: { students: CampusStudentRow[] }) {
  const colors = chartColors(useTheme());
  const [focus, setFocus] = useState<Group | null>(null);
  const placed = students
    .map((student) => ({ student, group: groupOf(student) }))
    .filter((entry): entry is { student: CampusStudentRow; group: Group } => entry.group !== null);
  if (placed.length < 3) return null;
  const counts = Object.fromEntries(
    (Object.keys(GROUPS) as Group[]).map((group) => [
      group,
      placed.filter((entry) => entry.group === group).length,
    ])
  ) as Record<Group, number>;
  const listed = focus ? placed.filter((entry) => entry.group === focus) : [];

  return (
    <section className={cn(panel, 'p-5')}>
      <h2 className="text-lg font-bold">Attendance vs. scores</h2>
      <p className="text-sm text-slate-500">
        Each dot is a student: class attendance across, PRIME test average up. Lines at{' '}
        {ATTENDANCE_OK}% attendance and {SCORE_OK}% score. Click a group to list its students.
      </p>
      <div className="mt-4 grid gap-5 lg:grid-cols-5">
        <div className="h-72 lg:col-span-3">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="Attendance"
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 11, fill: colors.tick }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Score"
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 11, fill: colors.tick }}
              />
              <ZAxis range={[28, 28]} />
              <ReferenceLine x={ATTENDANCE_OK} stroke={colors.tick} strokeDasharray="4 4" />
              <ReferenceLine y={SCORE_OK} stroke={colors.tick} strokeDasharray="4 4" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  background: colors.tooltip,
                  border: `1px solid ${colors.grid}`,
                  borderRadius: 12,
                  color: colors.text,
                  fontSize: 12,
                }}
                formatter={(value, key) => [`${value}%`, key === 'x' ? 'Attendance' : 'Score']}
                labelFormatter={() => ''}
              />
              <Scatter
                data={placed.map(({ student, group }) => ({
                  x: student.attendance_pct,
                  y: student.avg_pct,
                  group,
                  name: student.name,
                }))}
                isAnimationActive={false}
              >
                {placed.map(({ student, group }) => (
                  <Cell
                    key={student.username}
                    fill={GROUPS[group].color}
                    fillOpacity={focus && focus !== group ? 0.15 : 0.75}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
          {(Object.keys(GROUPS) as Group[]).map((group) => {
            const { title, who, color, icon: Icon } = GROUPS[group];
            return (
              <button
                key={group}
                type="button"
                onClick={() => setFocus(focus === group ? null : group)}
                aria-pressed={focus === group}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 text-left transition',
                  focus === group
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <span
                  className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{title}</span>
                    <span className="text-lg font-bold tabular-nums">{counts[group]}</span>
                  </span>
                  <span className="block text-xs text-slate-500">{who}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {focus && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-2 text-sm font-semibold">
            {GROUPS[focus].title} · {listed.length}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {listed.map(({ student }) => (
              <li key={student.username}>
                <Link
                  to="/s/$slug"
                  params={{ slug: student.username }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs hover:border-slate-300"
                >
                  {student.name}
                  <span className="text-slate-500 tabular-nums">
                    {student.attendance_pct}% · {student.avg_pct}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export { attendanceFill, attendanceTone };
