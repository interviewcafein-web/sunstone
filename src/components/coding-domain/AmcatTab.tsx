// AMCAT & Assessments: which batch sat which AMCAT cycle, skills and employability by cycle,
// module averages, the LMS AMCAT mock tests (trend, participation, readiness bands) and each
// student's scores.

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Award, CalendarCheck, ClipboardList, Layers, Search, Users } from 'lucide-react';

import { ExportButtons } from '@/components/common/ExportButtons';
import { scoreTone } from '@/lib/assessments';
import {
  BANDS,
  bandOf,
  employable,
  mockAverage,
  mockNumbers,
  pct,
  type CodingStudent,
  type Cycle,
} from '@/lib/codingDomain';
import { cohortLabel } from '@/lib/cohorts';
import type { ExportColumn } from '@/lib/exportTable';
import { cn } from '@/lib/utils';

import {
  AmcatScore,
  BRAND,
  Bar,
  Card,
  Delta,
  PlacedBadge,
  Title,
  TrackBadge,
  known,
  median,
  td,
  th,
} from './amcat-ui';
import { CampusRows, MiniTable, StudentGroups, compareBatch, groupBy } from './grouped';
import type { TabProps } from './types';

const SKILLS = [
  { key: 'c', label: 'Comms' },
  { key: 'a', label: 'Aptitude' },
  { key: 'd', label: 'Domain' },
] as const;

/** An AMCAT module outside comms, aptitude and domain shows once this many students took it. */
const MIN_OTHER = 10;

const batchKey = (row: CodingStudent) => `${row.program}|${row.year ?? ''}`;

export default function AmcatTab(props: TabProps) {
  const { students } = props;
  if (!students.length) {
    return (
      <Card className="border-dashed text-center">
        <p className="font-semibold text-slate-700">No Students Here</p>
        <p className="mt-1 text-sm text-slate-500">Change the filters to see AMCAT numbers.</p>
      </Card>
    );
  }
  return (
    <>
      <Schedule {...props} />
      <SkillsByCycle {...props} />
      <ModuleAverages {...props} />
      <MockTests {...props} />
      <StudentScores {...props} />
    </>
  );
}

// --- 1. Which batch sat which cycle ---------------------------------------------------------

interface ScheduleRow {
  campus: string;
  program: string;
  year: number | null;
  students: CodingStudent[];
  sat: Record<string, number>;
}

function Schedule({ data, students, scope, pass, studentLink }: TabProps) {
  const groups = useMemo(() => {
    const summarise = (list: CodingStudent[]): ScheduleRow => ({
      campus: list[0].campus,
      program: list[0].program,
      year: list[0].year,
      students: list,
      sat: Object.fromEntries(
        data.cycles.map((cycle) => [cycle.key, list.filter((row) => row.amcat[cycle.key]).length])
      ),
    });
    return groupBy(students, (row) => row.campus)
      .map(([campus, list]) => ({
        campus,
        total: summarise(list),
        rows: groupBy(list, batchKey)
          .map(([, rows]) => summarise(rows))
          .sort(compareBatch),
      }))
      .sort((a, b) => a.campus.localeCompare(b.campus));
  }, [data.cycles, students]);
  const rows = groups.flatMap((group) => group.rows);
  const columns: ExportColumn<ScheduleRow>[] = [
    { header: 'Campus', value: (row) => row.campus },
    { header: 'Program', value: (row) => row.program },
    { header: 'Batch', value: (row) => cohortLabel(row.program, String(row.year ?? '')) },
    { header: 'Students', value: (row) => row.students.length },
    ...data.cycles.flatMap((cycle) => [
      { header: `${cycle.label} sat`, value: (row: ScheduleRow) => row.sat[cycle.key] },
      {
        header: `${cycle.label} sat %`,
        value: (row: ScheduleRow) => pct(row.sat[cycle.key], row.students.length),
      },
    ]),
  ];
  return (
    <Card>
      <Title
        icon={CalendarCheck}
        title="AMCAT Cycles"
        description="Which batches sat each AMCAT cycle, and what share of the batch took it, college by college. Open a batch to see its students."
        aside={
          <ExportButtons
            name={`amcat-cycles-${scope}`}
            sheet="AMCAT cycles"
            columns={columns}
            rows={rows}
          />
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2 font-semibold">College, Program and Batch</th>
              <th className={th}>Students</th>
              {data.cycles.map((cycle) => (
                <th key={cycle.key} className="px-2 py-2 text-center font-semibold">
                  {cycle.label}
                </th>
              ))}
            </tr>
          </thead>
          <CampusRows
            groups={groups}
            colSpan={data.cycles.length + 2}
            rowKey={(row) => `${row.program}|${row.year}`}
            label={(row) => cohortLabel(row.program, String(row.year ?? ''))}
            cells={(row) => (
              <>
                <td className={td}>{row.students.length.toLocaleString('en-IN')}</td>
                {data.cycles.map((cycle) => {
                  const sat = row.sat[cycle.key];
                  return (
                    <td key={cycle.key} className="px-2 py-2 text-center tabular-nums">
                      {sat ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-bold text-emerald-600">✓</span>
                          <span className="text-xs text-slate-600">
                            {pct(sat, row.students.length)}% · {sat}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  );
                })}
              </>
            )}
            students={(row) => (
              <MiniTable
                rows={[...row.students].sort((a, b) => a.name.localeCompare(b.name))}
                rowKey={(student) => student.slug}
                columns={[
                  {
                    header: 'Student',
                    cell: (student) =>
                      studentLink(
                        student.slug,
                        <span className="text-brand-700 dark:text-brand-300 font-semibold hover:underline">
                          {student.name}
                        </span>
                      ),
                  },
                  ...data.cycles.map((cycle) => ({
                    header: `${cycle.label} (Comms · Apt · Domain)`,
                    cell: (student: CodingStudent) => {
                      const scores = student.amcat[cycle.key];
                      return scores ? (
                        <span className="whitespace-nowrap">
                          <AmcatScore value={scores.c} pass={pass} />
                          <span className="text-slate-300"> · </span>
                          <AmcatScore value={scores.a} pass={pass} />
                          <span className="text-slate-300"> · </span>
                          <AmcatScore value={scores.d} pass={pass} />
                        </span>
                      ) : (
                        <span className="text-slate-400">Not taken</span>
                      );
                    },
                  })),
                ]}
              />
            )}
          />
        </table>
      </div>
    </Card>
  );
}

// --- 2. Skills and employability by cycle ------------------------------------------------------

interface CycleStats {
  cycle: Cycle;
  students: number;
  sat: number;
  skills: Record<
    'c' | 'a' | 'd',
    {
      given: number;
      avg: number | null;
      median: number | null;
      passed: number;
      rate: number | null;
    }
  >;
  basic: { judged: number; yes: number; rate: number | null };
  overall: { judged: number; yes: number; rate: number | null };
}

function cycleStats(students: CodingStudent[], cycle: Cycle, pass: number): CycleStats {
  const sat = students.filter((row) => row.amcat[cycle.key]);
  const skill = (key: 'c' | 'a' | 'd') => {
    const values = known(sat.map((row) => row.amcat[cycle.key][key]));
    const passed = values.filter((value) => value >= pass).length;
    return {
      given: values.length,
      avg: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
      median: median(values),
      passed,
      rate: pct(passed, values.length),
    };
  };
  const level = (name: 'basic' | 'overall') => {
    const results = sat
      .map((row) => employable(row.amcat[cycle.key], pass, name))
      .filter((value) => value !== null);
    const yes = results.filter(Boolean).length;
    return { judged: results.length, yes, rate: pct(yes, results.length) };
  };
  return {
    cycle,
    students: students.length,
    sat: sat.length,
    skills: { c: skill('c'), a: skill('a'), d: skill('d') },
    basic: level('basic'),
    overall: level('overall'),
  };
}

function SkillsByCycle({ students, cycles, pass, scope }: TabProps) {
  const stats = useMemo(
    () => cycles.map((cycle) => cycleStats(students, cycle, pass)),
    [cycles, students, pass]
  );
  if (!stats.length) {
    return (
      <Card>
        <Title icon={Award} title="Skills by Cycle" />
        <p className="text-sm text-slate-500">No AMCAT sittings for these students yet.</p>
      </Card>
    );
  }
  const columns: ExportColumn<CycleStats>[] = [
    { header: 'Cycle', value: (row) => row.cycle.label },
    { header: 'Students', value: (row) => row.students },
    { header: 'Sat', value: (row) => row.sat },
    { header: 'Participation %', value: (row) => pct(row.sat, row.students) },
    ...SKILLS.flatMap(({ key, label }) => [
      { header: `${label} given`, value: (row: CycleStats) => row.skills[key].given },
      { header: `${label} average`, value: (row: CycleStats) => row.skills[key].avg },
      { header: `${label} median`, value: (row: CycleStats) => row.skills[key].median },
      { header: `${label} passed (${pass}+)`, value: (row: CycleStats) => row.skills[key].passed },
      { header: `${label} pass %`, value: (row: CycleStats) => row.skills[key].rate },
    ]),
    { header: 'Basic employable judged', value: (row) => row.basic.judged },
    { header: 'Basic employable', value: (row) => row.basic.yes },
    { header: 'Basic employable %', value: (row) => row.basic.rate },
    { header: 'Overall employable judged', value: (row) => row.overall.judged },
    { header: 'Overall employable', value: (row) => row.overall.yes },
    { header: 'Overall employable %', value: (row) => row.overall.rate },
  ];
  const latestFirst = [...stats].reverse();
  return (
    <Card>
      <Title
        icon={Award}
        title="Skills by Cycle"
        description={`Average, median and pass rate at ${pass}+ for each skill, and who is employable: basic = comms and aptitude both at the pass mark; overall = domain too.`}
        aside={
          <ExportButtons
            name={`amcat-skills-by-cycle-${scope}`}
            sheet="Skills by cycle"
            columns={columns}
            rows={stats}
          />
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {latestFirst.map((stat, index) => {
          const before = latestFirst[index + 1];
          return (
            <div key={stat.cycle.key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg font-bold">{stat.cycle.label}</p>
                <p className="text-xs text-slate-500">
                  {stat.sat.toLocaleString('en-IN')} of {stat.students.toLocaleString('en-IN')} sat
                </p>
              </div>
              <Bar pct={pct(stat.sat, stat.students)} className="mt-1" />
              <p className="mt-1 text-xs text-slate-500">
                Participation {pct(stat.sat, stat.students) ?? 0}%{' '}
                {before && (
                  <Delta
                    now={pct(stat.sat, stat.students)}
                    before={pct(before.sat, before.students)}
                    unit=" pts"
                  />
                )}
              </p>
              <ul className="mt-3 space-y-2.5">
                {SKILLS.map(({ key, label }) => {
                  const skill = stat.skills[key];
                  return (
                    <li key={key}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          <b
                            className={cn(
                              (skill.rate ?? 0) >= 50 ? 'text-emerald-600' : 'text-red-600'
                            )}
                          >
                            {skill.rate ?? 0}% pass
                          </b>{' '}
                          {before && <Delta now={skill.rate} before={before.skills[key].rate} />}
                        </span>
                      </div>
                      <Bar pct={skill.rate} className="mt-1" />
                      <p className="mt-0.5 flex justify-between text-[11px] text-slate-500">
                        <span>
                          {skill.passed} passed / {skill.given} given
                        </span>
                        <span>
                          avg {skill.avg ?? '—'} · med {skill.median ?? '—'}
                        </span>
                      </p>
                    </li>
                  );
                })}
                {(['basic', 'overall'] as const).map((level) => {
                  const value = stat[level];
                  return (
                    <li key={level}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">
                          {level === 'basic' ? 'Basic Employable' : 'Overall Employable'}
                        </span>
                        <span className="text-xs tabular-nums">
                          <b>{value.rate ?? 0}%</b>{' '}
                          {before && <Delta now={value.rate} before={before[level].rate} />}
                        </span>
                      </div>
                      <Bar pct={value.rate} color="#10b981" className="mt-1" />
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {value.yes} employable / {value.judged} judged
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// --- Module averages ------------------------------------------------------------------------

function ModuleAverages({ data, students, cycles, pass, scope }: TabProps) {
  const rows = useMemo(() => {
    const listed = new Set<string>([
      ...data.skills.comms,
      ...data.skills.aptitude,
      ...data.skills.domain,
    ]);
    const others = new Set<string>();
    for (const row of students)
      for (const scores of Object.values(row.amcat))
        for (const name of Object.keys(scores.m)) if (!listed.has(name)) others.add(name);
    const groups: [string, string[]][] = [
      ['Comms', data.skills.comms],
      ['Aptitude', data.skills.aptitude],
      ['Domain', data.skills.domain],
      ['Other', [...others].sort()],
    ];
    return (
      groups
        .flatMap(([group, modules]) =>
          modules.map((module) => {
            const averages = Object.fromEntries(
              cycles.map((cycle) => {
                const values = known(students.map((row) => row.amcat[cycle.key]?.m[module]));
                return [
                  cycle.key,
                  {
                    avg: values.length
                      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
                      : null,
                    given: values.length,
                  },
                ];
              })
            );
            return { group, module, averages };
          })
        )
        // Other modules a handful of students took (sales, finance) are left out.
        .filter((row) =>
          Object.values(row.averages).some(
            (value) => value.given >= (row.group === 'Other' ? MIN_OTHER : 1)
          )
        )
    );
  }, [data.skills, students, cycles]);
  type Row = (typeof rows)[number];
  if (!rows.length || !cycles.length) return null;
  const last = cycles[cycles.length - 1];
  const previous = cycles[cycles.length - 2];
  const columns: ExportColumn<Row>[] = [
    { header: 'Skill', value: (row) => row.group },
    { header: 'Module', value: (row) => row.module },
    ...cycles.flatMap((cycle) => [
      { header: `${cycle.label} average`, value: (row: Row) => row.averages[cycle.key].avg },
      { header: `${cycle.label} given`, value: (row: Row) => row.averages[cycle.key].given },
    ]),
    ...(previous
      ? [
          {
            header: `${last.label} vs ${previous.label}`,
            value: (row: Row) => {
              const now = row.averages[last.key].avg;
              const before = row.averages[previous.key].avg;
              return now == null || before == null ? null : now - before;
            },
          },
        ]
      : []),
  ];
  let group = '';
  return (
    <Card>
      <Title
        icon={Layers}
        title="Module Averages by Cycle"
        description="Average score in each AMCAT module, for the students who took it."
        aside={
          <ExportButtons
            name={`amcat-modules-${scope}`}
            sheet="Modules by cycle"
            columns={columns}
            rows={rows}
          />
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2 font-semibold">Module</th>
              {previous && (
                <th className={th}>
                  {last.label} vs {previous.label}
                </th>
              )}
              {[...cycles].reverse().map((cycle) => (
                <th key={cycle.key} className={th}>
                  {cycle.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const heading = row.group !== group;
              group = row.group;
              return [
                heading && (
                  <tr key={`${row.group}-head`} className="bg-slate-50 dark:bg-slate-800/40">
                    <td
                      colSpan={cycles.length + 2}
                      className="px-2 py-1.5 text-xs font-bold tracking-wide text-slate-600 uppercase"
                    >
                      {row.group}
                    </td>
                  </tr>
                ),
                <tr key={row.module} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-2 pl-3">{row.module}</td>
                  {previous && (
                    <td className={td}>
                      <Delta
                        now={row.averages[last.key].avg}
                        before={row.averages[previous.key].avg}
                      />
                    </td>
                  )}
                  {[...cycles].reverse().map((cycle) => (
                    <td key={cycle.key} className={td}>
                      <AmcatScore value={row.averages[cycle.key].avg} pass={pass} />
                      {row.averages[cycle.key].given > 0 && (
                        <span className="ml-1 text-[10px] text-slate-400">
                          ({row.averages[cycle.key].given})
                        </span>
                      )}
                    </td>
                  ))}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// --- 3. LMS AMCAT mock tests -------------------------------------------------------------------

function MockTests({ students, scope }: TabProps) {
  const numbers = useMemo(() => mockNumbers(students), [students]);
  const points = useMemo(
    () =>
      numbers.map((n) => {
        const released = students.filter((row) => n in row.mocks);
        const taken = known(released.map((row) => row.mocks[n]));
        return {
          test: `Mock ${n}`,
          released: released.length,
          taken: taken.length,
          participation: pct(taken.length, released.length),
          average: taken.length
            ? Math.round(taken.reduce((a, b) => a + b, 0) / taken.length)
            : null,
        };
      }),
    [numbers, students]
  );
  const bands = useMemo(() => {
    const averages = known(students.map(mockAverage));
    return {
      total: averages.length,
      rows: BANDS.map((band) => {
        const count = averages.filter((value) => bandOf(value)?.key === band.key).length;
        return { ...band, count, share: pct(count, averages.length) };
      }),
    };
  }, [students]);
  type Point = (typeof points)[number];
  const columns: ExportColumn<Point>[] = [
    { header: 'Mock test', value: (row) => row.test },
    { header: 'Released to', value: (row) => row.released },
    { header: 'Took it', value: (row) => row.taken },
    { header: 'Participation %', value: (row) => row.participation },
    { header: 'Average score %', value: (row) => row.average },
  ];
  type BandRow = (typeof bands.rows)[number];
  const bandColumns: ExportColumn<BandRow>[] = [
    { header: 'Readiness band', value: (row) => row.label },
    { header: 'Students', value: (row) => row.count },
    { header: 'Share %', value: (row) => row.share },
  ];
  return (
    <Card>
      <Title
        icon={ClipboardList}
        title="AMCAT Mock Tests (LMS)"
        description="The AMCAT mock tests in the LMS (Prime Domain Coding): average score of those who took each, how many of those it was released to took it, and readiness bands on each student's mock average."
        aside={
          numbers.length > 0 && (
            <ExportButtons
              name={`amcat-mock-tests-${scope}`}
              sheet="Mock tests"
              columns={columns}
              rows={points}
              more={[{ sheet: 'Readiness bands', columns: bandColumns, rows: bands.rows }]}
            />
          )
        }
      />
      {!numbers.length ? (
        <p className="text-sm text-slate-500">
          No AMCAT mock tests have been released to these students in the LMS yet.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 16, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="test" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      `${value}%`,
                      name === 'average' ? 'Average score' : 'Participation',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="participation"
                    stroke="#94a3b8"
                    fill="#94a3b8"
                    fillOpacity={0.12}
                    strokeDasharray="4 3"
                  />
                  <Area
                    type="monotone"
                    dataKey="average"
                    stroke={BRAND}
                    fill={BRAND}
                    fillOpacity={0.18}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    label={{ position: 'top', fontSize: 11, formatter: (v: unknown) => `${v}%` }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {points.map((point, index) => (
                <div
                  key={point.test}
                  className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs dark:bg-slate-800/40"
                >
                  <p className="font-semibold">{point.test}</p>
                  <p className={cn('text-base font-bold tabular-nums', scoreTone(point.average))}>
                    {point.average ?? '—'}%{' '}
                    {index > 0 && <Delta now={point.average} before={points[index - 1].average} />}
                  </p>
                  <p className="text-slate-500">
                    {point.taken} of {point.released} took it ({point.participation ?? 0}%)
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="text-sm font-semibold">Readiness Bands</p>
            <p className="text-xs text-slate-500">
              {bands.total.toLocaleString('en-IN')} students who took at least one mock test, by
              their mock average.
            </p>
            <div className="mt-3 flex h-4 overflow-hidden rounded-full">
              {bands.rows.map((band) => (
                <span
                  key={band.key}
                  style={{ width: `${band.share ?? 0}%`, background: band.color }}
                  title={`${band.label}: ${band.count}`}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {bands.rows.map((band) => (
                <li key={band.key} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-sm"
                    style={{ background: band.color }}
                  />
                  <span className="min-w-0 flex-1">{band.label}</span>
                  <b className="tabular-nums">{band.count}</b>
                  <span className="w-10 text-right text-xs text-slate-500 tabular-nums">
                    {band.share ?? 0}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

// --- 4. Each student's scores -------------------------------------------------------------------

type Sort = 'name' | 'mock' | 'amcat';

function BandChip({ score }: { score: number | null }) {
  const band = bandOf(score);
  if (!band) return <span className="text-slate-300">—</span>;
  const dark = band.key === 'high' || band.key === 'low';
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{
        background: `color-mix(in srgb, ${band.color} ${dark ? 22 : 40}%, transparent)`,
        color: band.key === 'high' ? '#166534' : band.key === 'low' ? '#991b1b' : '#3f3f46',
      }}
    >
      {band.label.replace(/ \(.*\)$/, '')}
    </span>
  );
}

function StudentScores({ students, cycle, pass, scope, search, studentLink }: TabProps) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('mock');
  const numbers = useMemo(() => mockNumbers(students), [students]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = students
      .filter((row) => !needle || row.name.toLowerCase().includes(needle))
      .map((row) => {
        const scores = cycle ? row.amcat[cycle.key] : undefined;
        const skills = known([scores?.c, scores?.a, scores?.d]);
        return {
          row,
          mock: mockAverage(row),
          scores,
          amcat: skills.length ? skills.reduce((a, b) => a + b, 0) / skills.length : null,
          basic: employable(scores, pass),
        };
      });
    const value = (item: (typeof list)[number]) => (sort === 'mock' ? item.mock : item.amcat) ?? -1;
    return list.sort((a, b) =>
      sort === 'name'
        ? a.row.name.localeCompare(b.row.name)
        : value(b) - value(a) || a.row.name.localeCompare(b.row.name)
    );
  }, [students, q, sort, cycle, pass]);
  type Item = (typeof rows)[number];
  const columns: ExportColumn<Item>[] = [
    { header: 'Name', value: (item) => item.row.name },
    { header: 'Username', value: (item) => item.row.slug },
    { header: 'Campus', value: (item) => item.row.campus },
    { header: 'Program', value: (item) => item.row.program },
    {
      header: 'Batch',
      value: (item) => cohortLabel(item.row.program, String(item.row.year ?? '')),
    },
    { header: 'COE track', value: (item) => item.row.track },
    { header: 'LMS cohorts', value: (item) => item.row.cohorts.join(', ') },
    {
      header: 'Placement',
      value: (item) =>
        item.row.placed === 'full-time'
          ? 'Placed (full-time)'
          : item.row.placed === 'internship'
            ? 'Internship'
            : '',
    },
    ...numbers.map((n) => ({
      header: `Mock ${n} %`,
      value: (item: Item) =>
        !(n in item.row.mocks) ? '' : item.row.mocks[n] == null ? 'Not taken' : item.row.mocks[n],
    })),
    { header: 'Mock average %', value: (item) => item.mock },
    { header: 'Readiness band', value: (item) => bandOf(item.mock)?.label ?? '' },
    ...(cycle
      ? [
          { header: `AMCAT ${cycle.label} comms`, value: (item: Item) => item.scores?.c },
          { header: `AMCAT ${cycle.label} aptitude`, value: (item: Item) => item.scores?.a },
          { header: `AMCAT ${cycle.label} domain`, value: (item: Item) => item.scores?.d },
          {
            header: `Basic employable ${cycle.label} (${pass}+)`,
            value: (item: Item) => (item.basic === null ? '' : item.basic ? 'Yes' : 'No'),
          },
        ]
      : []),
  ];
  const sortButton = (key: Sort, label: string) => (
    <button
      type="button"
      aria-pressed={sort === key}
      onClick={() => setSort(key)}
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-semibold',
        sort === key ? 'bg-surface text-brand-700 shadow' : 'text-slate-600'
      )}
    >
      {label}
    </button>
  );
  return (
    <Card>
      <Title
        icon={Users}
        title="Student-wise Scores"
        description={`Each student's mock tests, readiness band${cycle ? `, and AMCAT ${cycle.label} skills` : ''}.`}
        aside={
          <>
            <label className="relative">
              <Search
                className="pointer-events-none absolute top-2 left-2.5 size-4 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search by name"
                className="bg-surface w-52 rounded-full border border-slate-300 py-1.5 pr-3 pl-8 text-sm"
              />
            </label>
            <span className="flex rounded-full bg-slate-100 p-1" role="group" aria-label="Sort by">
              {sortButton('mock', 'Mock Average')}
              {cycle && sortButton('amcat', 'AMCAT')}
              {sortButton('name', 'Name')}
            </span>
            <ExportButtons
              name={`student-scores-${scope}`}
              sheet="Student scores"
              columns={columns}
              rows={rows}
            />
          </>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2 font-semibold">Student</th>
              {numbers.map((n) => (
                <th key={n} className={th}>
                  Mock {n}
                </th>
              ))}
              <th className={th}>Average</th>
              <th className="px-2 py-2 font-semibold">Readiness</th>
              {cycle && (
                <>
                  <th className={th}>Comms</th>
                  <th className={th}>Aptitude</th>
                  <th className={th}>Domain</th>
                  <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                    Employable {cycle.label}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <StudentGroups
            items={rows}
            studentOf={itemStudent}
            allCampuses={!search.campus}
            colSpan={numbers.length + 3 + (cycle ? 4 : 0)}
            forceOpen={Boolean(q.trim())}
            summary={(list) => {
              const mocks = known(list.map((item) => item.mock));
              return mocks.length
                ? `mock average ${Math.round(mocks.reduce((x, y) => x + y, 0) / mocks.length)}%`
                : 'no mock taken';
            }}
            renderRow={({ row, mock, scores, basic }) => (
              <tr key={row.slug} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2">
                  {studentLink(
                    row.slug,
                    <span className="text-brand-700 dark:text-brand-300 font-semibold hover:underline">
                      {row.name}
                    </span>
                  )}
                  <div className="text-xs text-slate-500">
                    {row.campus} · {cohortLabel(row.program, String(row.year ?? ''))}
                  </div>
                  {(row.track || row.placed) && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <TrackBadge track={row.track} />
                      <PlacedBadge placed={row.placed} />
                    </div>
                  )}
                </td>
                {numbers.map((n) => (
                  <td key={n} className={td}>
                    {!(n in row.mocks) ? null : row.mocks[n] == null ? (
                      <span className="text-xs text-slate-400">Not taken</span>
                    ) : (
                      <span className={cn('font-semibold', scoreTone(row.mocks[n]))}>
                        {row.mocks[n]}%
                      </span>
                    )}
                  </td>
                ))}
                <td className={cn(td, 'font-bold', scoreTone(mock))}>
                  {mock == null ? '—' : `${mock}%`}
                </td>
                <td className="px-2 py-2">
                  <BandChip score={mock} />
                </td>
                {cycle && (
                  <>
                    <td className={td}>
                      <AmcatScore value={scores?.c} pass={pass} />
                    </td>
                    <td className={td}>
                      <AmcatScore value={scores?.a} pass={pass} />
                    </td>
                    <td className={td}>
                      <AmcatScore value={scores?.d} pass={pass} />
                    </td>
                    <td className="px-2 py-2 text-center text-xs font-semibold">
                      {basic === null ? (
                        <span className="text-slate-300">—</span>
                      ) : basic ? (
                        <span className="text-emerald-600">Yes</span>
                      ) : (
                        <span className="text-red-600">No</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            )}
          />
        </table>
      </div>
      {!rows.length && (
        <p className="py-6 text-center text-sm text-slate-500">No students match this search.</p>
      )}
    </Card>
  );
}

const itemStudent = (item: { row: CodingStudent }) => item.row;
