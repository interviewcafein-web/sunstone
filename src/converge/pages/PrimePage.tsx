// PRIME Domain: every PRIME domain subject (MBA domains, BBA career tracks) at each campus and
// batch — tests and assignments, hours planned and taught, AMCAT — and PRIME against placements.
// Every table downloads as CSV or Excel. Numbers from api/prime.ts.

import { useMemo, useState, type ReactNode } from 'react';
import {
  Award,
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  Clock,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Loader2,
  Scale,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

import { PageLoader } from '@/components/common/PageLoader';
import { scoreTone } from '@/lib/assessments';
import { cohortLabel } from '@/lib/cohorts';
import { downloadCsv, downloadXlsx, type ExportColumn, type ExportSheet } from '@/lib/exportTable';
import { ROLE_LABELS, formatPay, type PlacementMeasure } from '@/lib/placements';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

import { Empty, Hero, HeroStat, Problem, SectionTitle, heroGrid, panel } from '../components/ui';
import {
  primeKey,
  savePlannedHours,
  usePrime,
  type OptInRow,
  type PrimeAmcatRow,
  type PrimeResponse,
  type PrimeSubjectRow,
} from '../lib/primeApi';
import { useRouteSearch, useSetSearch } from '../nav';
import type { PrimeSearch, PrimeTab } from '../routes';

const TABS: { id: PrimeTab; label: string; icon: typeof Layers }[] = [
  { id: 'overview', label: 'Overview', icon: Layers },
  { id: 'hours', label: 'Hours', icon: Clock },
  { id: 'assignments', label: 'Assignments', icon: ClipboardCheck },
  { id: 'amcat', label: 'AMCAT', icon: Award },
  { id: 'placements', label: 'Placement Impact', icon: Target },
];

const BRAND = 'var(--color-brand-600)';

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : null);
const sum = <T,>(rows: T[], value: (row: T) => number | null | undefined) =>
  rows.reduce((total, row) => total + (value(row) ?? 0), 0);
/** Average of a per-row value, weighted (e.g. a score by how many submitted). */
function weighted<T>(rows: T[], value: (row: T) => number | null, weight: (row: T) => number) {
  let total = 0;
  let weights = 0;
  for (const row of rows) {
    const v = value(row);
    const w = weight(row);
    if (v != null && w > 0) {
      total += v * w;
      weights += w;
    }
  }
  return weights ? Math.round(total / weights) : null;
}
const batchOf = (row: { program: string; admission_year: number }) =>
  cohortLabel(row.program, String(row.admission_year));
/** Planned hours for every section of a row (planned is per section). */
const plannedTotal = (row: PrimeSubjectRow) =>
  row.planned_hours == null ? null : row.planned_hours * Math.max(row.sections, 1);
const shortSubject = (subject: string) => subject.replace(/ Prime Domain$/, '');
const fmt = (value: number | null | undefined, unit = '') =>
  value == null ? '—' : `${Number(value.toFixed(1)).toLocaleString('en-IN')}${unit}`;

export default function PrimePage() {
  const search = useRouteSearch<PrimeSearch>();
  const setSearch = useSetSearch<PrimeSearch>();
  const tab = search.tab ?? 'overview';
  const query = usePrime(search.campus);
  const data = query.data;

  const subjects = useMemo(
    () => (data?.subjects ?? []).filter((row) => !search.program || row.program === search.program),
    [data, search.program]
  );
  const amcat = useMemo(
    () => (data?.amcat ?? []).filter((row) => !search.program || row.program === search.program),
    [data, search.program]
  );

  if (query.isPending) return <PageLoader label="Loading the PRIME overview" />;
  if (!data)
    return <Problem message={query.error?.message ?? ''} onRetry={() => query.refetch()} />;

  const programs = [...new Set(data.subjects.map((row) => row.program))].sort();
  const assigned = sum(subjects, (row) => row.assigned);
  const attempted = sum(subjects, (row) => row.attempted);
  const delivered = sum(subjects, (row) => row.total_hours);
  const planned = sum(subjects, plannedTotal);
  const subjectNames = new Set(subjects.map((row) => row.subject));
  const campusCount = new Set(subjects.map((row) => row.campus_id)).size;
  const scope = [
    search.campus
      ? data.campuses.find((campus) => campus.id === search.campus)?.name
      : 'All Campuses',
    search.program,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-5">
      <Hero
        eyebrow="PRIME Domain"
        title="Delivery, Engagement and Outcomes"
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {query.isFetching && (
              <Loader2 className="text-brand-200 size-4 animate-spin" aria-label="Updating" />
            )}
            {data.campuses.length > 1 && (
              <select
                aria-label="Campus"
                value={search.campus ?? ''}
                onChange={(event) =>
                  setSearch({ campus: event.target.value ? Number(event.target.value) : undefined })
                }
                className="max-w-56 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white [&>option]:text-slate-900"
              >
                <option value="">All Campuses</option>
                {data.campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            )}
            {programs.length > 1 && (
              <select
                aria-label="Program"
                value={search.program ?? ''}
                onChange={(event) => setSearch({ program: event.target.value || undefined })}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white [&>option]:text-slate-900"
              >
                <option value="">BBA and MBA</option>
                {programs.map((program) => (
                  <option key={program}>{program}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() =>
                downloadXlsx(`converge-prime-domain-${scope}`, allSheets(data, subjects, amcat))
              }
              className="text-brand-800 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow"
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              Download All
            </button>
          </div>
        }
      >
        <p className="text-brand-100 relative mt-2 max-w-3xl text-sm">
          The MBA PRIME domains and the BBA career tracks, from the LMS: what has been taught, what
          students submitted, and how it shows in placements.
        </p>
        <dl className={cn(heroGrid, 'mt-5')}>
          <HeroStat
            icon={Layers}
            label="Subjects"
            value={subjectNames.size}
            note={`at ${campusCount} campuses`}
          />
          <HeroStat
            icon={BookOpenCheck}
            label="Tests Released"
            value={sum(subjects, (row) => row.published)}
          />
          <HeroStat
            icon={ClipboardCheck}
            label="Submitted"
            value={pct(attempted, assigned)}
            suffix="%"
          />
          <HeroStat
            icon={TrendingUp}
            label="Average Score"
            value={weighted(
              subjects,
              (row) => row.avg_score,
              (row) => row.attempted
            )}
            suffix="%"
          />
          <HeroStat
            icon={Clock}
            label="Hours Taught"
            value={Math.round(delivered)}
            note={planned ? `of ${Math.round(planned)} planned` : undefined}
          />
        </dl>
      </Hero>

      <nav
        aria-label="PRIME Domain views"
        className="scrollbar-none flex gap-1 overflow-x-auto rounded-full bg-slate-100/80 p-1"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setSearch({ tab: id === 'overview' ? undefined : id })}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition',
              tab === id
                ? 'bg-surface text-brand-700 dark:text-brand-200 shadow-[0_1px_3px_rgb(15_23_42/0.12)] ring-1 ring-slate-200'
                : 'hover:text-brand-700 text-slate-600'
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {!subjects.length && tab !== 'placements' ? (
        <Empty title="No PRIME Domain Subjects Here">
          Subjects show once the LMS has them for these campuses and batches.
        </Empty>
      ) : (
        <div className="animate-rise space-y-5" key={tab}>
          {tab === 'overview' && <Overview rows={subjects} scope={scope} />}
          {tab === 'hours' && (
            <Hours rows={subjects} data={data} scope={scope} campus={search.campus} />
          )}
          {tab === 'assignments' && <Assignments rows={subjects} data={data} scope={scope} />}
          {tab === 'amcat' && <Amcat rows={amcat} data={data} scope={scope} />}
          {tab === 'placements' && <PlacementImpact data={data} scope={scope} />}
        </div>
      )}
      <p className="text-xs text-slate-500">
        From the LMS, synced every night. Planned hours are {data.hoursPerCredit} per LMS credit
        unless HQ has set them.
      </p>
    </div>
  );
}

// --- Building blocks ---------------------------------------------------------------------

function ExportButtons<T>({
  name,
  sheet,
  columns,
  rows,
}: {
  name: string;
  sheet: string;
  columns: ExportColumn<T>[];
  rows: T[];
}) {
  const button =
    'inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-brand-700';
  return (
    <span className="flex gap-1.5">
      <button type="button" className={button} onClick={() => downloadCsv(name, columns, rows)}>
        <Download className="size-3.5" aria-hidden />
        CSV
      </button>
      <button
        type="button"
        className={button}
        onClick={() => downloadXlsx(name, [{ sheet, columns, rows }])}
      >
        <FileSpreadsheet className="size-3.5" aria-hidden />
        Excel
      </button>
    </span>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn(panel, 'p-5', className)}>{children}</section>;
}

function Bar({
  value,
  color = BRAND,
  className,
}: {
  value: number | null;
  color?: string;
  className?: string;
}) {
  return (
    <span className={cn('block h-1.5 overflow-hidden rounded-full bg-slate-100', className)}>
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: color }}
      />
    </span>
  );
}

/** A percentage with a bar under it. */
function Rate({ value, tone = true }: { value: number | null; tone?: boolean }) {
  return (
    <span className="inline-flex min-w-16 flex-col items-end">
      <span className={cn('font-semibold tabular-nums', tone && scoreTone(value))}>
        {value == null ? '—' : `${value}%`}
      </span>
      <Bar value={value} className="mt-0.5 w-14" />
    </span>
  );
}

function Table({
  head,
  children,
  min = '48rem',
}: {
  head: ReactNode[];
  children: ReactNode;
  min?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: min }}>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            {head.map((cell, index) => (
              <th
                key={index}
                className={cn(
                  'px-2 py-2 font-semibold',
                  index > 0 && 'text-right',
                  index === 0 && 'pl-0'
                )}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const td = 'px-2 py-2 text-right tabular-nums';

/** Subject rows summed across campuses and batches. */
function bySubject(rows: PrimeSubjectRow[]) {
  const groups = new Map<string, PrimeSubjectRow[]>();
  for (const row of rows) groups.set(row.subject, [...(groups.get(row.subject) ?? []), row]);
  return [...groups]
    .map(([subject, list]) => ({
      subject,
      campuses: new Set(list.map((row) => row.campus_id)).size,
      batches: list.length,
      students: sum(list, (row) => row.students),
      created: sum(list, (row) => row.created),
      published: sum(list, (row) => row.published),
      assigned: sum(list, (row) => row.assigned),
      attempted: sum(list, (row) => row.attempted),
      graded: sum(list, (row) => row.graded),
      avg: weighted(
        list,
        (row) => row.avg_score,
        (row) => row.attempted
      ),
      modules: sum(list, (row) => row.modules),
      started: sum(list, (row) => row.modules_started),
      attendance: weighted(
        list,
        (row) => row.attendance,
        (row) => row.students
      ),
      delivered: sum(list, (row) => row.total_hours),
      planned: sum(list, plannedTotal),
    }))
    .sort((a, b) => b.students - a.students);
}
type SubjectSummary = ReturnType<typeof bySubject>[number];

const ROW_COLUMNS: ExportColumn<PrimeSubjectRow>[] = [
  { header: 'Campus', value: (row) => row.campus },
  { header: 'Program', value: (row) => row.program },
  { header: 'Batch', value: (row) => batchOf(row) },
  { header: 'Subject', value: (row) => row.subject },
  { header: 'Students', value: (row) => row.students },
  { header: 'Tests created', value: (row) => row.created },
  { header: 'Tests released', value: (row) => row.published },
  { header: 'Assigned (student × test)', value: (row) => row.assigned },
  { header: 'Submitted', value: (row) => row.attempted },
  { header: 'Submitted %', value: (row) => pct(row.attempted, row.assigned) },
  { header: 'Graded', value: (row) => row.graded },
  { header: 'Awaiting grading', value: (row) => row.attempted - row.graded },
  { header: 'Average score %', value: (row) => row.avg_score },
  { header: 'Modules', value: (row) => row.modules },
  { header: 'Modules started', value: (row) => row.modules_started },
  { header: 'Attendance %', value: (row) => row.attendance },
  { header: 'Sections', value: (row) => row.sections },
  { header: 'Planned hours per section', value: (row) => row.planned_hours },
  {
    header: 'Planned from',
    value: (row) =>
      row.planned_source === 'hq'
        ? 'HQ'
        : row.planned_source === 'credits'
          ? `${row.credits} LMS credits`
          : '',
  },
  { header: 'Hours taught per section', value: (row) => row.hours_per_section },
  { header: 'Hours taught (all sections)', value: (row) => row.total_hours },
  { header: 'Classes', value: (row) => row.classes },
  { header: 'Trainers', value: (row) => row.trainers },
  { header: 'Last class', value: (row) => row.last_class },
];

const SUBJECT_COLUMNS: ExportColumn<SubjectSummary>[] = [
  { header: 'Subject', value: (row) => row.subject },
  { header: 'Campuses', value: (row) => row.campuses },
  { header: 'Campus batches', value: (row) => row.batches },
  { header: 'Students', value: (row) => row.students },
  { header: 'Tests released', value: (row) => row.published },
  { header: 'Submitted %', value: (row) => pct(row.attempted, row.assigned) },
  { header: 'Graded %', value: (row) => pct(row.graded, row.attempted) },
  { header: 'Average score %', value: (row) => row.avg },
  { header: 'Modules started %', value: (row) => pct(row.started, row.modules) },
  { header: 'Attendance %', value: (row) => row.attendance },
  { header: 'Hours taught', value: (row) => Math.round(row.delivered) },
  { header: 'Hours planned', value: (row) => Math.round(row.planned) },
  { header: 'Taught %', value: (row) => pct(row.delivered, row.planned) },
];

const AMCAT_COLUMNS = (sections: string[]): ExportColumn<PrimeAmcatRow>[] => [
  { header: 'Campus', value: (row) => row.campus },
  { header: 'Program', value: (row) => row.program },
  { header: 'Batch', value: (row) => batchOf(row) },
  { header: 'Students', value: (row) => row.students },
  { header: 'Took AMCAT', value: (row) => row.with_sitting },
  { header: 'Took AMCAT %', value: (row) => pct(row.with_sitting, row.students) },
  { header: 'Sittings', value: (row) => row.sittings },
  { header: 'Latest sitting average', value: (row) => row.latest_avg },
  ...sections.map((section) => ({
    header: section,
    value: (row: PrimeAmcatRow) => row.sections?.[section] ?? null,
  })),
];

const OPT_IN_COLUMNS: ExportColumn<OptInRow>[] = [
  {
    header: 'Batch',
    value: (row) => (row.overall ? 'All compared batches' : `${row.program} ${row.admission_year}`),
  },
  { header: 'PRIME opt-in', value: (row) => (row.opted_in ? 'Yes' : 'No') },
  { header: 'Students', value: (row) => row.students },
  { header: 'Full-time placed', value: (row) => row.ft_placed },
  { header: 'Full-time placed %', value: (row) => pct(row.ft_placed, row.students) },
  { header: 'Median CTC (LPA)', value: (row) => row.ft_median },
  { header: 'Highest CTC (LPA)', value: (row) => row.ft_highest },
  { header: 'With internship', value: (row) => row.in_placed },
  { header: 'With internship %', value: (row) => pct(row.in_placed, row.students) },
  { header: 'Median stipend (₹/month)', value: (row) => row.in_median },
];

function sectionsOf(rows: PrimeAmcatRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows)
    for (const name of Object.keys(row.sections ?? {}))
      counts.set(name, (counts.get(name) ?? 0) + row.with_sitting);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

function allSheets(
  data: PrimeResponse,
  subjects: PrimeSubjectRow[],
  amcat: PrimeAmcatRow[]
): ExportSheet<any>[] {
  const fit = data.placement.flatMap((entry) =>
    (entry.fit?.rows ?? []).map((row) => ({
      kind: entry.kind,
      columns: entry.fit!.columns,
      ...row,
    }))
  );
  return [
    { sheet: 'Subjects', columns: SUBJECT_COLUMNS, rows: bySubject(subjects) },
    { sheet: 'Campus batches', columns: ROW_COLUMNS, rows: subjects },
    { sheet: 'AMCAT', columns: AMCAT_COLUMNS(sectionsOf(amcat)), rows: amcat },
    { sheet: 'Opt-in vs not', columns: OPT_IN_COLUMNS, rows: data.optIn.rows },
    {
      sheet: 'Domain vs role',
      columns: [
        {
          header: 'Offers',
          value: (row: (typeof fit)[number]) =>
            row.kind === 'full-time' ? 'Full-time' : 'Internship',
        },
        { header: 'PRIME domain', value: (row: (typeof fit)[number]) => row.domain },
        { header: 'Offers in total', value: (row: (typeof fit)[number]) => row.offers },
        { header: 'In their domain', value: (row: (typeof fit)[number]) => row.matched },
        { header: 'In their domain %', value: (row: (typeof fit)[number]) => row.rate },
        ...[...new Set(fit.flatMap((row) => row.columns))].map((column) => ({
          header: ROLE_LABELS[column] ?? column,
          value: (row: (typeof fit)[number]) => row.cells[column] ?? 0,
        })),
      ],
      rows: fit,
    },
  ];
}

// --- Overview ----------------------------------------------------------------------------

function Overview({ rows, scope }: { rows: PrimeSubjectRow[]; scope: string }) {
  const summary = bySubject(rows);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summary.map((subject) => (
          <Card key={subject.subject} className="p-4">
            <p className="font-semibold">{subject.subject}</p>
            <p className="text-xs text-slate-500">
              {subject.students.toLocaleString('en-IN')} students · {subject.campuses} campus
              {subject.campuses === 1 ? '' : 'es'} · {subject.batches} batch
              {subject.batches === 1 ? '' : 'es'}
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ['Submitted', pct(subject.attempted, subject.assigned)],
                ['Avg Score', subject.avg],
                ['Attendance', subject.attendance],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/40"
                >
                  <dd
                    className={cn(
                      'text-lg font-bold tabular-nums',
                      scoreTone(value as number | null)
                    )}
                  >
                    {value == null ? '—' : `${value}%`}
                  </dd>
                  <dt className="text-[11px] text-slate-500">{label}</dt>
                </div>
              ))}
            </dl>
            <div className="mt-3 space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-slate-500">
                  <span>Modules started</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {subject.started} of {subject.modules}
                  </span>
                </div>
                <Bar value={pct(subject.started, subject.modules)} className="mt-1" />
              </div>
              <div>
                <div className="flex justify-between text-slate-500">
                  <span>Hours taught</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {Math.round(subject.delivered)}
                    {subject.planned ? ` of ${Math.round(subject.planned)} planned` : ''}
                  </span>
                </div>
                <Bar
                  value={pct(subject.delivered, subject.planned)}
                  color="#10b981"
                  className="mt-1"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <SectionTitle
          icon={Layers}
          title="By Campus and Batch"
          description="Each subject at each campus and batch: releases, submissions, scores, modules and attendance."
          aside={
            <ExportButtons
              name={`prime-domain-overview-${scope}`}
              sheet="Campus batches"
              columns={ROW_COLUMNS}
              rows={rows}
            />
          }
        />
        <div className="mt-3">
          <Table
            head={[
              'Campus and Batch',
              'Students',
              'Released',
              'Submitted',
              'Avg Score',
              'Modules',
              'Attendance',
              'Hours',
            ]}
            min="56rem"
          >
            {rows.map((row) => (
              <tr
                key={`${row.campus_id}-${row.program}-${row.admission_year}-${row.subject}`}
                className="border-b border-slate-100 last:border-0"
              >
                <td className="py-2 pr-2">
                  <div className="font-medium">{row.subject}</div>
                  <div className="text-xs text-slate-500">
                    {row.campus} · {batchOf(row)}
                  </div>
                </td>
                <td className={td}>{row.students}</td>
                <td className={td}>
                  {row.published} / {row.created}
                </td>
                <td className={td}>
                  <Rate value={pct(row.attempted, row.assigned)} />
                </td>
                <td className={cn(td, 'font-semibold', scoreTone(row.avg_score))}>
                  {row.avg_score == null ? '—' : `${row.avg_score}%`}
                </td>
                <td className={td}>
                  {row.modules_started} / {row.modules}
                </td>
                <td className={td}>
                  <Rate value={row.attendance} />
                </td>
                <td className={td}>
                  {fmt(row.hours_per_section)}
                  {row.planned_hours ? ` / ${fmt(row.planned_hours)}` : ''}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>
    </>
  );
}

// --- Hours -------------------------------------------------------------------------------

function Hours({
  rows,
  data,
  scope,
  campus,
}: {
  rows: PrimeSubjectRow[];
  data: PrimeResponse;
  scope: string;
  campus?: number;
}) {
  const summary = bySubject(rows);
  return (
    <>
      <Card>
        <SectionTitle
          icon={Clock}
          title="Planned and Taught, by Subject"
          description="Hours taught across every section, against the hours planned for those sections."
        />
        <ul className="mt-3 space-y-3">
          {summary.map((subject) => {
            const share = pct(subject.delivered, subject.planned);
            return (
              <li key={subject.subject}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{subject.subject}</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    <b className="text-slate-800 dark:text-slate-100">
                      {Math.round(subject.delivered)} h
                    </b>{' '}
                    of {Math.round(subject.planned) || '—'} h planned
                    {share != null ? ` · ${share}%` : ''}
                  </span>
                </div>
                <Bar value={share} color="#10b981" className="mt-1 h-2" />
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <SectionTitle
          icon={CalendarClock}
          title="Each Campus and Batch"
          description={
            data.canEditPlanned
              ? 'Planned hours are per section. Change one to set the agreed hours; clear it to go back to the LMS credits.'
              : 'Planned hours are per section, from the LMS credits unless HQ has set them.'
          }
          aside={
            <ExportButtons
              name={`prime-domain-hours-${scope}`}
              sheet="Hours"
              columns={ROW_COLUMNS}
              rows={rows}
            />
          }
        />
        <div className="mt-3">
          <Table
            head={[
              'Campus, Batch and Subject',
              'Sections',
              'Planned',
              'Taught',
              'Progress',
              'Classes',
              'Trainers',
              'Last Class',
            ]}
            min="62rem"
          >
            {rows.map((row) => (
              <tr
                key={`${row.campus_id}-${row.program}-${row.admission_year}-${row.subject}`}
                className="border-b border-slate-100 last:border-0"
              >
                <td className="py-2 pr-2">
                  <div className="font-medium">{shortSubject(row.subject)}</div>
                  <div className="text-xs text-slate-500">
                    {row.campus} · {batchOf(row)}
                  </div>
                </td>
                <td className={td}>{row.sections || '—'}</td>
                <td className={td}>
                  <PlannedCell row={row} editable={data.canEditPlanned} campus={campus} />
                </td>
                <td className={cn(td, 'font-semibold')}>{fmt(row.hours_per_section, ' h')}</td>
                <td className={td}>
                  <Rate
                    value={
                      row.planned_hours ? pct(row.hours_per_section ?? 0, row.planned_hours) : null
                    }
                    tone={false}
                  />
                </td>
                <td className={td}>{row.classes}</td>
                <td className="max-w-56 px-2 py-2 text-right text-xs text-slate-600">
                  {row.trainers ?? '—'}
                </td>
                <td className={cn(td, 'text-xs text-slate-600')}>{row.last_class ?? '—'}</td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>
    </>
  );
}

function PlannedCell({
  row,
  editable,
  campus,
}: {
  row: PrimeSubjectRow;
  editable: boolean;
  campus?: number;
}) {
  const client = useQueryClient();
  const [value, setValue] = useState(row.planned_hours == null ? '' : String(row.planned_hours));
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const source =
    row.planned_source === 'hq'
      ? 'Set by HQ'
      : row.planned_source === 'credits'
        ? `${row.credits} credits`
        : 'Not set';
  if (!editable) {
    return (
      <span className="inline-flex flex-col items-end">
        <span className="font-semibold">{fmt(row.planned_hours, ' h')}</span>
        <span className="text-[10px] text-slate-400">{source}</span>
      </span>
    );
  }
  const save = async () => {
    const hours = value.trim() === '' ? null : Number(value);
    if (hours !== null && !(hours >= 0 && hours <= 1000)) return setState('error');
    if (hours === (row.planned_source === 'hq' ? row.planned_hours : null)) return;
    setState('saving');
    try {
      await savePlannedHours({
        campusId: row.campus_id,
        program: row.program,
        admissionYear: row.admission_year,
        subject: row.subject,
        hours,
      });
      await client.invalidateQueries({ queryKey: primeKey(campus) });
      setState('idle');
    } catch {
      setState('error');
    }
  };
  return (
    <span className="inline-flex flex-col items-end">
      <input
        aria-label={`Planned hours, ${row.subject}, ${row.campus} ${batchOf(row)}`}
        inputMode="decimal"
        value={value}
        placeholder={row.credits ? String(row.credits * 15) : 'Hours'}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
        className={cn(
          'bg-surface w-16 rounded-md border px-1.5 py-0.5 text-right text-sm tabular-nums',
          state === 'error' ? 'border-red-400' : 'border-slate-300'
        )}
      />
      <span className="text-[10px] text-slate-400">
        {state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : source}
      </span>
    </span>
  );
}

// --- Assignments and AMCAT -----------------------------------------------------------------

function Assignments({
  rows,
  data,
  scope,
}: {
  rows: PrimeSubjectRow[];
  data: PrimeResponse;
  scope: string;
}) {
  const summary = bySubject(rows);
  return (
    <>
      <Card>
        <SectionTitle
          icon={ClipboardCheck}
          title="Assignments by Subject"
          description="Created in the LMS, released to students, submitted, and graded by the trainer."
          aside={
            <ExportButtons
              name={`prime-domain-assignments-${scope}`}
              sheet="Assignments"
              columns={SUBJECT_COLUMNS}
              rows={summary}
            />
          }
        />
        <div className="mt-3">
          <Table
            head={[
              'Subject',
              'Created',
              'Released',
              'Assigned',
              'Submitted',
              'Graded',
              'Awaiting Grading',
              'Avg Score',
            ]}
            min="54rem"
          >
            {summary.map((row) => (
              <tr key={row.subject} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2 font-medium">{row.subject}</td>
                <td className={td}>{row.created.toLocaleString('en-IN')}</td>
                <td className={td}>{row.published.toLocaleString('en-IN')}</td>
                <td className={td}>{row.assigned.toLocaleString('en-IN')}</td>
                <td className={td}>
                  <Rate value={pct(row.attempted, row.assigned)} />
                </td>
                <td className={td}>
                  <Rate value={pct(row.graded, row.attempted)} tone={false} />
                </td>
                <td
                  className={cn(
                    td,
                    row.attempted - row.graded > 0 && 'font-semibold text-amber-600'
                  )}
                >
                  {(row.attempted - row.graded).toLocaleString('en-IN')}
                </td>
                <td className={cn(td, 'font-semibold', scoreTone(row.avg))}>
                  {row.avg == null ? '—' : `${row.avg}%`}
                </td>
              </tr>
            ))}
          </Table>
          <p className="mt-2 text-xs text-slate-500">
            Created and released are counted per campus batch. Assigned is every student given a
            released test; submitted and graded are out of those.
          </p>
        </div>
      </Card>
      <Card>
        <SectionTitle
          icon={GraduationCap}
          title="Each Campus and Batch"
          aside={
            <ExportButtons
              name={`prime-domain-assignments-by-batch-${scope}`}
              sheet="Assignments by batch"
              columns={ROW_COLUMNS}
              rows={rows}
            />
          }
        />
        <div className="mt-3">
          <Table
            head={[
              'Campus, Batch and Subject',
              'Created',
              'Released',
              'Submitted',
              'Graded',
              'Awaiting',
              'Avg Score',
            ]}
            min="52rem"
          >
            {rows.map((row) => (
              <tr
                key={`${row.campus_id}-${row.program}-${row.admission_year}-${row.subject}`}
                className="border-b border-slate-100 last:border-0"
              >
                <td className="py-2 pr-2">
                  <div className="font-medium">{shortSubject(row.subject)}</div>
                  <div className="text-xs text-slate-500">
                    {row.campus} · {batchOf(row)}
                  </div>
                </td>
                <td className={td}>{row.created}</td>
                <td className={td}>{row.published}</td>
                <td className={td}>
                  <Rate value={pct(row.attempted, row.assigned)} />
                </td>
                <td className={td}>
                  <Rate value={pct(row.graded, row.attempted)} tone={false} />
                </td>
                <td className={td}>{row.attempted - row.graded}</td>
                <td className={cn(td, 'font-semibold', scoreTone(row.avg_score))}>
                  {row.avg_score == null ? '—' : `${row.avg_score}%`}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>
      <PrepAndPlacement
        data={data}
        keys={['domain', 'elq']}
        title="Assignment Scores and Placements"
      />
    </>
  );
}

function Amcat({
  rows,
  data,
  scope,
}: {
  rows: PrimeAmcatRow[];
  data: PrimeResponse;
  scope: string;
}) {
  const sections = sectionsOf(rows);
  const shown = sections.slice(0, 6);
  const students = sum(rows, (row) => row.students);
  const took = sum(rows, (row) => row.with_sitting);
  return (
    <>
      <Card>
        <SectionTitle
          icon={Award}
          title="AMCAT by Campus and Batch"
          description={`${took.toLocaleString('en-IN')} of ${students.toLocaleString('en-IN')} students have taken AMCAT (${pct(took, students) ?? 0}%). Scores are from each student's latest sitting.`}
          aside={
            <ExportButtons
              name={`prime-domain-amcat-${scope}`}
              sheet="AMCAT"
              columns={AMCAT_COLUMNS(sections)}
              rows={rows}
            />
          }
        />
        <div className="mt-3">
          <Table
            head={['Campus and Batch', 'Took AMCAT', 'Sittings', 'Latest Avg', ...shown]}
            min="60rem"
          >
            {rows.map((row) => (
              <tr
                key={`${row.campus_id}-${row.program}-${row.admission_year}`}
                className="border-b border-slate-100 last:border-0"
              >
                <td className="py-2 pr-2">
                  <div className="font-medium">{row.campus}</div>
                  <div className="text-xs text-slate-500">
                    {batchOf(row)} · {row.students} students
                  </div>
                </td>
                <td className={td}>
                  <Rate value={pct(row.with_sitting, row.students)} tone={false} />
                </td>
                <td className={td}>{row.sittings}</td>
                <td className={cn(td, 'font-semibold')}>{row.latest_avg ?? '—'}</td>
                {shown.map((section) => (
                  <td key={section} className={td}>
                    {row.sections?.[section] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </Table>
          {sections.length > shown.length && (
            <p className="mt-2 text-xs text-slate-500">
              The download has every AMCAT section ({sections.length}).
            </p>
          )}
        </div>
      </Card>
      <PrepAndPlacement data={data} keys={['amcat']} title="AMCAT and Placements" />
    </>
  );
}

/** Placed against still waiting on some measures, and the offer rate by quarter of the batch. */
function PrepAndPlacement({
  data,
  keys,
  title,
}: {
  data: PrimeResponse;
  keys: string[];
  title: string;
}) {
  const [kind, setKind] = useState<'full-time' | 'internship'>('internship');
  const entry = data.placement.find((item) => item.kind === kind);
  if (!entry) return null;
  const measures = new Map<string, PlacementMeasure>(entry.measures.map((m) => [m.key, m]));
  const rows = entry.prep.filter((row) => keys.includes(row.key));
  const word = kind === 'full-time' ? 'Placed' : 'With internship';
  return (
    <Card>
      <SectionTitle
        icon={TrendingUp}
        title={title}
        description="Students with an offer against those still waiting, and how often each quarter of the batch got one."
        aside={<KindToggle kind={kind} setKind={setKind} />}
      />
      {entry.totals.offers === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No {kind === 'full-time' ? 'job offers' : 'internships'} yet for these campuses.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {rows.map((row) => {
            const measure = measures.get(row.key);
            const show = (v: number | null) =>
              v == null ? '—' : `${Number(v.toFixed(1))}${measure?.unit ?? ''}`;
            const best = Math.max(1, ...row.bands.map((band) => band.rate ?? 0));
            return (
              <div key={row.key} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold">{measure?.label ?? row.key}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {word}: <b>{show(row.placedAvg)}</b> · Still waiting: <b>{show(row.othersAvg)}</b>
                </p>
                {row.bands.length === 4 && (
                  <div className="mt-3 flex h-20 items-end gap-2">
                    {row.bands.map((band, index) => (
                      <div
                        key={band.label}
                        className="flex flex-1 flex-col items-center justify-end"
                        title={`${band.label}: ${show(band.from)}–${show(band.to)}, ${band.placed} of ${band.students}`}
                      >
                        <span className="text-[11px] font-semibold tabular-nums">
                          {band.rate ?? 0}%
                        </span>
                        <span
                          className="w-full rounded-t-md"
                          style={{
                            height: `${Math.max(4, ((band.rate ?? 0) / best) * 52)}px`,
                            background: BRAND,
                            opacity: 0.35 + index * 0.2,
                          }}
                        />
                        <span className="mt-1 text-[10px] text-slate-500">
                          {['Bottom', 'Second', 'Third', 'Top'][index]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function KindToggle({
  kind,
  setKind,
}: {
  kind: 'full-time' | 'internship';
  setKind: (kind: 'full-time' | 'internship') => void;
}) {
  return (
    <span className="flex rounded-full bg-slate-100 p-1 text-xs">
      {(['internship', 'full-time'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={kind === option}
          onClick={() => setKind(option)}
          className={cn(
            'rounded-full px-2.5 py-1 font-semibold',
            kind === option ? 'bg-surface text-brand-700 shadow' : 'text-slate-600'
          )}
        >
          {option === 'full-time' ? 'Full-Time Jobs' : 'Internships'}
        </button>
      ))}
    </span>
  );
}

// --- Placement impact ----------------------------------------------------------------------

function PlacementImpact({ data, scope }: { data: PrimeResponse; scope: string }) {
  const [kind, setKind] = useState<'full-time' | 'internship'>('internship');
  const overall = data.optIn.rows.filter((row) => row.overall);
  const perBatch = data.optIn.rows.filter((row) => !row.overall);
  const compared = new Set(perBatch.map((row) => `${row.program}:${row.admission_year}`));
  const left = data.optIn.batches.filter(
    (batch) => !compared.has(`${batch.program}:${batch.admission_year}`)
  );
  const side = (optedIn: boolean) => overall.find((row) => row.opted_in === optedIn);
  const fit = data.placement.find((entry) => entry.kind === kind)?.fit;
  const fullTime = kind === 'full-time';

  return (
    <>
      <Card>
        <SectionTitle
          icon={Scale}
          title="PRIME Opt-in and Placement Outcomes"
          description={`PRIME opt-in students against students at the same campuses who did not opt in, in the same batches. Only batches with at least ${data.optIn.minSide} students on each side are compared.`}
          aside={
            <ExportButtons
              name={`prime-opt-in-placements-${scope}`}
              sheet="Opt-in vs not"
              columns={OPT_IN_COLUMNS}
              rows={data.optIn.rows}
            />
          }
        />
        {!overall.length ? (
          <p className="mt-3 text-sm text-slate-500">
            No batch here has enough students on both sides to compare yet.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[true, false].map((optedIn) => {
                const row = side(optedIn);
                if (!row) return null;
                return (
                  <div
                    key={String(optedIn)}
                    className={cn(
                      'rounded-xl border p-4',
                      optedIn
                        ? 'border-brand-300 bg-brand-50/50 dark:bg-brand-900/20'
                        : 'border-slate-200'
                    )}
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      <Users className="size-4" aria-hidden />
                      {optedIn ? 'PRIME Opt-in' : 'Not Opted In'}
                      <span className="text-sm font-normal text-slate-500">
                        {row.students.toLocaleString('en-IN')} students
                      </span>
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">With an internship</dt>
                        <dd className="text-xl font-bold tabular-nums">
                          {pct(row.in_placed, row.students) ?? 0}%
                        </dd>
                        <dd className="text-xs text-slate-500">
                          {row.in_placed} · median {formatPay(row.in_median, false)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Full-time placed</dt>
                        <dd className="text-xl font-bold tabular-nums">
                          {pct(row.ft_placed, row.students) ?? 0}%
                        </dd>
                        <dd className="text-xs text-slate-500">
                          {row.ft_placed} · median {formatPay(row.ft_median, true)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <Table
                head={[
                  'Batch',
                  'Students',
                  'Internship',
                  'Median Stipend',
                  'Full-Time',
                  'Median CTC',
                ]}
                min="40rem"
              >
                {perBatch.map((row) => (
                  <tr
                    key={`${row.program}-${row.admission_year}-${row.opted_in}`}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2 pr-2">
                      <span className="font-medium">
                        {row.program} {row.admission_year}
                      </span>
                      <span
                        className={cn(
                          'ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          row.opted_in
                            ? 'bg-brand-50 text-brand-700'
                            : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {row.opted_in ? 'PRIME' : 'Not opted in'}
                      </span>
                    </td>
                    <td className={td}>{row.students}</td>
                    <td className={td}>
                      <Rate value={pct(row.in_placed, row.students)} tone={false} />
                    </td>
                    <td className={td}>{formatPay(row.in_median, false)}</td>
                    <td className={td}>
                      <Rate value={pct(row.ft_placed, row.students)} tone={false} />
                    </td>
                    <td className={td}>{formatPay(row.ft_median, true)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        )}
        {overall.length > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            Read this with care: very few students who did not opt in have any offer recorded in the
            LMS. If they do not take part in the LMS placement drives at all, the gap shows who is
            in the drives as much as what PRIME adds.
          </p>
        )}
        {left.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Not compared:{' '}
            {left
              .map(
                (batch) =>
                  `${batch.program} ${batch.admission_year} (${batch.opted_in} opted in, ${batch.not_opted_in} not)`
              )
              .join('; ')}
            . Older batches had no PRIME to opt into, so they would compare years rather than PRIME.
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle
          icon={Target}
          title="Domain Studied, Role Taken"
          description="Each student's PRIME domain or career track against the role they were selected for. Outlined cells count as a match."
          aside={<KindToggle kind={kind} setKind={setKind} />}
        />
        {!fit || !fit.rows.length ? (
          <p className="mt-3 text-sm text-slate-500">
            No {fullTime ? 'job offers' : 'internships'} yet for these campuses.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-semibold">PRIME Domain</th>
                  {fit.columns.map((column) => (
                    <th key={column} className="px-2 py-2 text-center font-semibold">
                      {ROLE_LABELS[column] ?? column}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-semibold">In Their Domain</th>
                </tr>
              </thead>
              <tbody>
                {fit.rows.map((row) => {
                  const max = Math.max(1, ...fit.rows.flatMap((r) => Object.values(r.cells)));
                  return (
                    <tr key={row.domain} className="border-t border-slate-200">
                      <th scope="row" className="py-2 pr-3 text-left font-medium">
                        {row.domain}
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          ({row.offers})
                        </span>
                      </th>
                      {fit.columns.map((column) => {
                        const count = row.cells[column] ?? 0;
                        const match = (row.matches ?? [row.domain]).includes(column);
                        return (
                          <td key={column} className="px-1 py-1 text-center">
                            <span
                              className={cn(
                                'block rounded-md py-1.5 tabular-nums',
                                match && count > 0 && 'ring-2 ring-emerald-500/70',
                                !count && 'text-slate-300'
                              )}
                              style={
                                count
                                  ? {
                                      background: `color-mix(in srgb, ${BRAND} ${10 + (count / max) * 55}%, transparent)`,
                                    }
                                  : undefined
                              }
                            >
                              {count || '·'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">
                        {row.domain === 'Not known' ? '—' : `${row.rate ?? 0}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              Sales and Marketing roles match Revenue Generation and the Business Development track;
              General Management and Operations roles match the Management Trainee Program.
            </p>
          </div>
        )}
      </Card>
    </>
  );
}
