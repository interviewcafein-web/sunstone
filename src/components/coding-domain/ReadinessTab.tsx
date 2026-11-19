// Placement Readiness: the LMS placement funnel (eligible, applied, shortlisted, interviewed,
// offered), funnel by batch, AMCAT domain-wise readiness, and every student's pipeline.

import { useMemo, useState, type ReactNode } from 'react';
import { BriefcaseBusiness, Filter, Layers, Search, Target, Users } from 'lucide-react';

import { ExportButtons } from '@/components/common/ExportButtons';
import { academicYearEnd, cohortLabel, compareProgram, isFinalYear } from '@/lib/cohorts';
import {
  FUNNEL,
  employable,
  pct,
  placedLabel,
  stageOf,
  type CodingStudent,
} from '@/lib/codingDomain';
import type { ExportColumn } from '@/lib/exportTable';
import { cn } from '@/lib/utils';

import type { TabProps } from './types';

const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';
const FUNNEL_COLORS = ['#1e40af', '#0284c7', '#0d9488', '#16a34a', '#ca8a04', '#ea580c'];
const td = 'px-2 py-2 text-right tabular-nums';
const PAGE = 50;

function Title({
  icon: Icon,
  title,
  description,
  aside,
}: {
  icon: typeof Users;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon className="text-brand-700 dark:text-brand-300 size-4.5" aria-hidden />
          {title}
        </h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {aside}
    </div>
  );
}

function Bar({ value, color }: { value: number | null; color: string }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-slate-100">
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: color }}
      />
    </span>
  );
}

const rateColor = (value: number | null) =>
  value == null ? '#cbd5e1' : value >= 60 ? '#16a34a' : value >= 40 ? '#f59e0b' : '#ef4444';

const batchOf = (row: CodingStudent) => cohortLabel(row.program, row.year);

export default function ReadinessTab(props: TabProps) {
  const { students, data, search, pass, cycle, scope } = props;
  const ready = (row: CodingStudent) => (cycle ? employable(row.amcat[cycle.key], pass) : null);
  // The funnel is about the placement batches: those in their final year.
  const finalYear = useMemo(
    () => students.filter((row) => isFinalYear(row.program, row.year)),
    [students]
  );
  return (
    <>
      <FunnelCard
        students={finalYear}
        ready={ready}
        scope={scope}
        cycleLabel={cycle?.label}
        pass={pass}
      />
      <BatchFunnel students={finalYear} allCampuses={!search.campus} scope={scope} />
      <DomainReadiness
        students={students}
        modules={data.skills.domain}
        cycleKey={cycle?.key}
        cycleLabel={cycle?.label}
        pass={pass}
        scope={scope}
      />
      <StudentsCard {...props} ready={ready} />
    </>
  );
}

// --- Funnel ---------------------------------------------------------------------------------

function FunnelCard({
  students,
  ready,
  scope,
  cycleLabel,
  pass,
}: {
  students: CodingStudent[];
  ready: (row: CodingStudent) => boolean | null;
  scope: string;
  cycleLabel?: string;
  pass: number;
}) {
  // Each placement batch (program and admission year), in HQ's program order.
  const batches = [
    ...students.reduce(
      (map, row) => map.set(`${row.program}|${row.year}`, { program: row.program, year: row.year }),
      new Map<string, { program: string; year: number | null }>()
    ),
  ]
    .map(([key, batch]) => ({
      key,
      ...batch,
      label: cohortLabel(batch.program, batch.year),
      size: students.filter((row) => `${row.program}|${row.year}` === key).length,
    }))
    .sort((a, b) => compareProgram(a.program, b.program) || (a.year ?? 0) - (b.year ?? 0));
  const stages = FUNNEL.map((stage) => {
    const reached = students.filter((row) => stage.test(row));
    return {
      key: stage.key,
      label: stage.label,
      count: reached.length,
      byBatch: batches.map((batch) => ({
        ...batch,
        count: reached.filter((row) => `${row.program}|${row.year}` === batch.key).length,
      })),
    };
  });
  const total = students.length;
  const judged = students.map(ready).filter((value) => value !== null);
  const readyCount = judged.filter(Boolean).length;
  const columns: ExportColumn<(typeof stages)[number]>[] = [
    { header: 'Stage', value: (row) => row.label },
    { header: 'Students', value: (row) => row.count },
    { header: '% of placement batch', value: (row) => pct(row.count, total) },
    ...batches.flatMap((batch, index) => [
      { header: batch.label, value: (row: (typeof stages)[number]) => row.byBatch[index].count },
      {
        header: `${batch.label} %`,
        value: (row: (typeof stages)[number]) => pct(row.byBatch[index].count, batch.size),
      },
    ]),
  ];
  if (!total) {
    return (
      <section className={cn(panel, 'p-5')}>
        <Title icon={Filter} title="Placement Funnel" />
        <p className="text-sm text-slate-500">
          The funnel covers the placement batches, those in their final year (B.Tech/BE{' '}
          {academicYearEnd() - 4}, BCA {academicYearEnd() - 3}, MCA {academicYearEnd() - 2}
          ). None are in this selection.
        </p>
      </section>
    );
  }
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Filter}
        title="Placement Funnel"
        description={`The placement batches (final year: ${batches.map((batch) => batch.label).join(', ')}): how many were eligible for an LMS opportunity, applied, were shortlisted in a round, reached an interview round and got an offer. Percentages are of the placement batch.`}
        aside={
          <ExportButtons
            name={`prime-coding-funnel-${scope}`}
            sheet="Funnel"
            columns={columns}
            rows={stages}
          />
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <ol className="space-y-2.5">
          {stages.map((stage, index) => {
            const share = pct(stage.count, total);
            return (
              <li key={stage.key}>
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 justify-center">
                    <div
                      className="flex h-9 items-center justify-center rounded-md text-sm font-bold text-white tabular-nums shadow-sm"
                      style={{
                        width: `${100 - index * 11}%`,
                        background: FUNNEL_COLORS[index],
                      }}
                    >
                      {stage.count.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <span className="w-24 text-sm font-medium sm:w-28">{stage.label}</span>
                  <span className="w-12 text-right text-xs text-slate-500 tabular-nums">
                    {share ?? 0}%
                  </span>
                </div>
                {/* This stage by program and batch: count, and % of that batch. */}
                <div className="mt-1 flex flex-wrap justify-center gap-1.5 sm:pr-40">
                  {stage.byBatch.map((batch) => (
                    <span
                      key={batch.key}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 tabular-nums dark:bg-slate-800 dark:text-slate-300"
                      title={`${batch.label}: ${batch.count} of ${batch.size} (${pct(batch.count, batch.size) ?? 0}%)`}
                    >
                      {batch.label}{' '}
                      <b className="text-slate-800 dark:text-slate-100">{batch.count}</b>
                      {stage.key !== 'registered' && (
                        <span className="text-slate-400">
                          {' '}
                          · {pct(batch.count, batch.size) ?? 0}%
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-col justify-center rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:bg-emerald-900/20">
          <p className="text-xs font-semibold tracking-wide text-emerald-800 uppercase dark:text-emerald-200">
            Interview Ready (AMCAT)
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {judged.length ? `${pct(readyCount, judged.length)}%` : '—'}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {readyCount} of {judged.length} judged{cycleLabel ? ` in ${cycleLabel}` : ''}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Basic employable: comms and aptitude both at {pass} or more. The LMS has no
            &ldquo;training completed&rdquo; or &ldquo;interview ready&rdquo; stage, so readiness
            comes from AMCAT.
          </p>
        </div>
      </div>
    </section>
  );
}

function BatchFunnel({
  students,
  allCampuses,
  scope,
}: {
  students: CodingStudent[];
  allCampuses: boolean;
  scope: string;
}) {
  const rows = useMemo(() => {
    const groups = new Map<string, CodingStudent[]>();
    for (const row of students) {
      const key = `${allCampuses ? row.campus : ''}|${row.program}|${row.year ?? ''}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.values()]
      .map((list) => ({
        campus: list[0].campus,
        program: list[0].program,
        year: list[0].year,
        counts: Object.fromEntries(
          FUNNEL.map((stage) => [stage.key, list.filter((row) => stage.test(row)).length])
        ) as Record<string, number>,
      }))
      .sort(
        (a, b) =>
          a.campus.localeCompare(b.campus) ||
          compareProgram(a.program, b.program) ||
          (b.year ?? 0) - (a.year ?? 0)
      );
  }, [students, allCampuses]);
  type Row = (typeof rows)[number];
  const columns: ExportColumn<Row>[] = [
    ...(allCampuses ? [{ header: 'Campus', value: (row: Row) => row.campus }] : []),
    { header: 'Program', value: (row) => row.program },
    { header: 'Batch', value: (row) => cohortLabel(row.program, row.year) },
    ...FUNNEL.map((stage) => ({ header: stage.label, value: (row: Row) => row.counts[stage.key] })),
    { header: 'Offer rate %', value: (row) => pct(row.counts.offered, row.counts.registered) },
  ];
  if (!rows.length) return null;
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Layers}
        title="Funnel by Batch"
        description="Each stage of the funnel for every placement (final-year) batch in view."
        aside={
          <ExportButtons
            name={`prime-coding-funnel-by-batch-${scope}`}
            sheet="Funnel by batch"
            columns={columns}
            rows={rows}
          />
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2 font-semibold">Batch</th>
              {FUNNEL.map((stage) => (
                <th key={stage.key} className="px-2 py-2 text-right font-semibold">
                  {stage.label}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold">Offer Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rate = pct(row.counts.offered, row.counts.registered);
              return (
                <tr
                  key={`${row.campus}|${row.program}|${row.year}`}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-2 pr-2">
                    <div className="font-medium">{cohortLabel(row.program, row.year)}</div>
                    {allCampuses && <div className="text-xs text-slate-500">{row.campus}</div>}
                  </td>
                  {FUNNEL.map((stage) => (
                    <td key={stage.key} className={td}>
                      {row.counts[stage.key].toLocaleString('en-IN')}
                    </td>
                  ))}
                  <td className={cn(td, 'font-semibold')}>{rate == null ? '—' : `${rate}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// --- Domain readiness -----------------------------------------------------------------------

const MODULE_LABELS: Record<string, string> = { Automata: 'Automata (Coding)' };

function DomainReadiness({
  students,
  modules,
  cycleKey,
  cycleLabel,
  pass,
  scope,
}: {
  students: CodingStudent[];
  modules: string[];
  cycleKey?: string;
  cycleLabel?: string;
  pass: number;
  scope: string;
}) {
  const rows = useMemo(
    () =>
      cycleKey
        ? modules
            .map((module) => {
              const scores = students
                .map((row) => row.amcat[cycleKey]?.m[module])
                .filter((value): value is number => typeof value === 'number');
              return {
                module,
                label: MODULE_LABELS[module] ?? module,
                took: scores.length,
                average: scores.length
                  ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                  : null,
                passed: scores.filter((value) => value >= pass).length,
              };
            })
            .filter((row) => row.took > 0)
        : [],
    [students, modules, cycleKey, pass]
  );
  type Row = (typeof rows)[number];
  const columns: ExportColumn<Row>[] = [
    { header: 'Domain module', value: (row) => row.label },
    { header: 'Students who took it', value: (row) => row.took },
    { header: 'Average score', value: (row) => row.average },
    { header: `At or above ${pass}`, value: (row) => row.passed },
    { header: `At or above ${pass} %`, value: (row) => pct(row.passed, row.took) },
  ];
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Target}
        title="Domain-wise Readiness"
        description={`AMCAT domain modules${cycleLabel ? ` in ${cycleLabel}` : ''}: the share of students who took each one and scored ${pass} or more.`}
        aside={
          <ExportButtons
            name={`prime-coding-domain-readiness-${scope}`}
            sheet="Domain readiness"
            columns={columns}
            rows={rows}
          />
        }
      />
      {!rows.length ? (
        <p className="py-4 text-sm text-slate-500">
          No AMCAT domain modules taken by these students in this cycle.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const share = pct(row.passed, row.took);
            return (
              <li key={row.module}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    <b className="text-slate-800 dark:text-slate-100">{share ?? 0}%</b> ·{' '}
                    {row.passed} of {row.took} · average {row.average ?? '—'}
                  </span>
                </div>
                <div className="mt-1">
                  <Bar value={share} color={rateColor(share)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// --- Students -------------------------------------------------------------------------------

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        className
      )}
    >
      {children}
    </span>
  );
}

const STAGE_TONES: Record<string, string> = {
  registered: 'bg-slate-100 text-slate-600',
  eligible: 'bg-sky-50 text-sky-700',
  applied: 'bg-indigo-50 text-indigo-700',
  shortlisted: 'bg-teal-50 text-teal-700',
  interviewed: 'bg-amber-50 text-amber-700',
  offered: 'bg-emerald-50 text-emerald-700',
};

function offerStatus(row: CodingStudent): string {
  const label = placedLabel(row.placed);
  if (label) {
    const first = row.offers[0];
    const where = first ? [first.company, first.role].filter(Boolean).join(' · ') : '';
    return where ? `${label}: ${where}` : label;
  }
  if (row.pipeline.applied > 0 || row.pipeline.shortlisted > 0) return 'In process';
  return '—';
}

function StudentsCard({
  students,
  cycle,
  scope,
  studentLink,
  ready,
}: TabProps & { ready: (row: CodingStudent) => boolean | null }) {
  const [stage, setStage] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const cycleKey = cycle?.key;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students
      .filter((row) => !stage || stageOf(row).key === stage)
      .filter(
        (row) =>
          !needle ||
          row.name.toLowerCase().includes(needle) ||
          row.offers.some((offer) => offer.company?.toLowerCase().includes(needle))
      )
      .sort(
        (a, b) =>
          FUNNEL.findIndex((s) => s.key === stageOf(b).key) -
            FUNNEL.findIndex((s) => s.key === stageOf(a).key) ||
          b.pipeline.applied - a.pipeline.applied ||
          a.name.localeCompare(b.name)
      );
  }, [students, stage, q]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of students) counts[stageOf(row).key] = (counts[stageOf(row).key] ?? 0) + 1;
    return counts;
  }, [students]);

  const coding = (row: CodingStudent) => (cycleKey ? (row.amcat[cycleKey]?.d ?? null) : null);
  const automata = (row: CodingStudent) =>
    cycleKey ? (row.amcat[cycleKey]?.m.Automata ?? null) : null;
  const yesNo = (value: boolean | null) => (value === null ? '' : value ? 'Yes' : 'No');

  const columns: ExportColumn<CodingStudent>[] = [
    { header: 'Name', value: (row) => row.name },
    { header: 'Username', value: (row) => row.slug },
    { header: 'Campus', value: (row) => row.campus },
    { header: 'Program', value: (row) => row.program },
    { header: 'Batch', value: (row) => batchOf(row) },
    { header: 'COE track', value: (row) => row.track },
    { header: 'LMS cohorts', value: (row) => row.cohorts.join(', ') },
    { header: 'Eligible for (opportunities)', value: (row) => row.pipeline.eligible },
    { header: 'Applied', value: (row) => row.pipeline.applied },
    { header: 'Shortlisted', value: (row) => row.pipeline.shortlisted },
    { header: 'Interview rounds', value: (row) => row.pipeline.interviews },
    { header: `AMCAT domain average${cycle ? ` (${cycle.label})` : ''}`, value: coding },
    { header: `AMCAT Automata${cycle ? ` (${cycle.label})` : ''}`, value: automata },
    { header: 'Problems solved', value: (row) => row.solved },
    { header: 'Interview ready (AMCAT)', value: (row) => yesNo(ready(row)) },
    { header: 'Stage', value: (row) => stageOf(row).label },
    { header: 'Offer status', value: offerStatus },
  ];

  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Users}
        title="Students"
        description="Each student's eligibility, applications, coding scores and offer status."
        aside={
          <ExportButtons
            name={`prime-coding-readiness-students-${scope}`}
            sheet="Students"
            columns={columns}
            rows={rows}
          />
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={!stage}
          onClick={() => {
            setStage(null);
            setLimit(PAGE);
          }}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-semibold',
            !stage ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 text-slate-600'
          )}
        >
          All ({students.length})
        </button>
        {FUNNEL.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={stage === item.key}
            onClick={() => {
              setStage(stage === item.key ? null : item.key);
              setLimit(PAGE);
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold',
              stage === item.key
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-200 text-slate-600'
            )}
          >
            {item.label} ({stageCounts[item.key] ?? 0})
          </button>
        ))}
        <label className="relative ml-auto">
          <Search
            className="pointer-events-none absolute top-2 left-2.5 size-4 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search name or company"
            className="bg-surface w-60 rounded-full border border-slate-300 py-1.5 pr-3 pl-8 text-sm"
          />
        </label>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        Stage is the furthest the student has got. Stage filters count each student once.
      </p>
      {!rows.length ? (
        <p className="py-6 text-center text-sm text-slate-500">No students here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[68rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-2 font-semibold">Student</th>
                <th className="px-2 py-2 font-semibold">Eligibility</th>
                <th className="px-2 py-2 text-right font-semibold">Applied</th>
                <th className="px-2 py-2 text-right font-semibold">Shortlisted</th>
                <th className="px-2 py-2 text-right font-semibold">Interviews</th>
                <th className="px-2 py-2 text-right font-semibold">Coding Score</th>
                <th className="px-2 py-2 text-center font-semibold">Interview Ready</th>
                <th className="px-2 py-2 font-semibold">Stage</th>
                <th className="px-2 py-2 font-semibold">Offer Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((row) => {
                const isReady = ready(row);
                const current = stageOf(row);
                const domain = coding(row);
                const auto = automata(row);
                return (
                  <tr key={row.slug} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-2">
                      {studentLink(
                        row.slug,
                        <span className="text-brand-700 dark:text-brand-300 font-semibold hover:underline">
                          {row.name}
                        </span>
                      )}
                      <div className="text-xs text-slate-500">
                        {row.campus} · {batchOf(row)}
                      </div>
                      {(row.track || row.cohorts.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.track && (
                            <Chip className="bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200">
                              COE · {row.track}
                            </Chip>
                          )}
                          {row.cohorts.map((cohort) => (
                            <Chip
                              key={cohort}
                              className={
                                /super|pinnacle/i.test(cohort)
                                  ? 'bg-amber-50 text-[#a8741f]'
                                  : 'bg-slate-100 text-slate-600'
                              }
                            >
                              {cohort}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {row.pipeline.eligible > 0 ? (
                        <Chip className="bg-emerald-50 text-emerald-700">
                          Eligible for {row.pipeline.eligible}
                        </Chip>
                      ) : (
                        <span className="text-slate-400">Not yet eligible</span>
                      )}
                    </td>
                    <td className={td}>{row.pipeline.applied || '—'}</td>
                    <td className={td}>{row.pipeline.shortlisted || '—'}</td>
                    <td className={td}>{row.pipeline.interviews || '—'}</td>
                    <td className={td}>
                      <span className="font-semibold">{domain ?? '—'}</span>
                      {(auto != null || row.solved != null) && (
                        <div className="text-[11px] text-slate-500">
                          {[
                            auto != null && `Automata ${auto}`,
                            row.solved != null && `${row.solved} solved`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center text-xs">
                      {isReady === null ? (
                        <span className="text-slate-400">—</span>
                      ) : isReady ? (
                        <Chip className="bg-emerald-50 text-emerald-700">Yes</Chip>
                      ) : (
                        <Chip className="bg-rose-50 text-rose-700">No</Chip>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Chip className={STAGE_TONES[current.key]}>{current.label}</Chip>
                    </td>
                    <td className="max-w-64 px-2 py-2 text-xs">
                      {row.placed ? (
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">
                          {offerStatus(row)}
                        </span>
                      ) : (
                        <span className="text-slate-600">{offerStatus(row)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setLimit((current) => current + PAGE * 4)}
            className="text-brand-700 rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold"
          >
            Show More ({rows.length - limit} left)
          </button>
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <BriefcaseBusiness className="size-3.5" aria-hidden />
        Coding score is the AMCAT domain average{cycle ? ` in ${cycle.label}` : ''}.
      </p>
    </section>
  );
}
