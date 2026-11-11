// Placements: job offers and internships from the LMS, set against how the students prepared.
// The same page on Vertex (coding, PRIME mock tests) and Converge (PRIME domains,
// communication and aptitude); the measures and the role-fit card come from the API.

import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Crown,
  IndianRupee,
  Loader2,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { PageLoader } from '@/components/common/PageLoader';
import { scoreTone } from '@/lib/assessments';
import { cohortLabel } from '@/lib/cohorts';
import {
  ROLE_LABELS,
  formatPay,
  type FitMatrix,
  type PlacementKind,
  type PlacementsSearch,
  type PlacementMeasure,
  type PlacementStudent,
  type PlacementsResponse,
  type RoleGroup,
} from '@/lib/placements';
import { usePlacements } from '@/lib/placementsApi';
import { cn } from '@/lib/utils';

const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';
const BRAND = 'var(--color-brand-600)';

type StudentLink = (slug: string, children: ReactNode) => ReactNode;

export default function PlacementsPage({
  search,
  setSearch,
  studentLink,
}: {
  search: PlacementsSearch;
  setSearch: (patch: Partial<PlacementsSearch>) => void;
  studentLink: StudentLink;
}) {
  const kind = search.kind ?? 'full-time';
  const query = usePlacements(kind, search.campus);
  const data = query.data;

  if (query.isPending) return <PageLoader label="Loading placements" />;
  if (!data) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
      >
        <p className="font-semibold">Placements did not load.</p>
        <p className="mt-1">{query.error?.message}</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="bg-surface mt-3 rounded-md border border-red-300 px-3 py-1.5 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  const fullTime = kind === 'full-time';
  const pay = (value: number | null | undefined) => formatPay(value, fullTime);
  const measureOf = Object.fromEntries(data.measures.map((m) => [m.key, m]));

  return (
    <div className="space-y-6">
      <Hero
        data={data}
        kind={kind}
        search={search}
        setSearch={setSearch}
        pay={pay}
        fetching={query.isFetching}
      />

      {data.totals.students === 0 ? (
        <div className={cn(panel, 'border-dashed p-8 text-center')}>
          <p className="font-semibold text-slate-700">
            No {fullTime ? 'Job Offers' : 'Internships'} Yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Batches show here once the LMS has {fullTime ? 'job offers' : 'internships'} for them.
          </p>
        </div>
      ) : (
        <>
          <Prep data={data} measureOf={measureOf} pay={pay} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Campuses
              data={data}
              pay={pay}
              onPick={(id) => setSearch({ campus: id ?? undefined })}
            />
            <Cohorts data={data} pay={pay} />
          </div>
          <Fit data={data} measureOf={measureOf} pay={pay} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Roles data={data} pay={pay} />
            <Companies data={data} pay={pay} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Joining data={data} />
            <Months data={data} />
          </div>
          <ActionLists data={data} studentLink={studentLink} />
          <Offers data={data} pay={pay} studentLink={studentLink} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Hero({
  data,
  kind,
  search,
  setSearch,
  pay,
  fetching,
}: {
  data: PlacementsResponse;
  kind: PlacementKind;
  search: PlacementsSearch;
  setSearch: (patch: Partial<PlacementsSearch>) => void;
  pay: (value: number | null) => string;
  fetching: boolean;
}) {
  const { totals } = data;
  const fullTime = kind === 'full-time';
  const batches = data.batches.map((b) => cohortLabel(b.program, String(b.year))).join(', ');
  return (
    <section className="from-brand-700 via-brand-800 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7">
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-brand-200 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
            <span aria-hidden className="bg-brand-300 h-px w-6" />
            Placements
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
            Who Got Placed, and What Got Them There
          </h1>
          <p className="text-brand-100 mt-1 max-w-2xl text-sm">
            {fullTime ? 'Full-time job offers' : 'Internships'} from the LMS
            {batches ? ` for ${batches}` : ''}, set against how each student prepared.
            {data.syncedAt && (
              <>
                {' '}
                Updated{' '}
                {new Date(data.syncedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
                .
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fetching && (
            <Loader2 className="text-brand-200 size-4 animate-spin" aria-label="Updating" />
          )}
          <div
            className="flex rounded-full bg-white/10 p-1 text-sm"
            role="group"
            aria-label="Kind of offer"
          >
            {(['full-time', 'internship'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={kind === option}
                onClick={() => setSearch({ kind: option === 'full-time' ? undefined : option })}
                className={cn(
                  'rounded-full px-3 py-1 font-medium transition',
                  kind === option
                    ? 'text-brand-800 bg-white shadow'
                    : 'text-white/80 hover:text-white'
                )}
              >
                {option === 'full-time' ? 'Full-Time Jobs' : 'Internships'}
              </button>
            ))}
          </div>
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
        </div>
      </div>
      <dl className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          icon={Users}
          label="Students in Season"
          value={totals.students.toLocaleString('en-IN')}
        />
        <Stat
          icon={UserCheck}
          label={fullTime ? 'Placed' : 'With an Internship'}
          value={totals.placed.toLocaleString('en-IN')}
          note={totals.rate != null ? `${totals.rate}%` : undefined}
        />
        <Stat
          icon={BriefcaseBusiness}
          label="Offers"
          value={totals.offers.toLocaleString('en-IN')}
        />
        <Stat
          icon={IndianRupee}
          label={fullTime ? 'Median CTC' : 'Median Stipend'}
          value={pay(totals.medianPay)}
        />
        <Stat
          icon={Trophy}
          label={fullTime ? 'Highest CTC' : 'Highest Stipend'}
          value={pay(totals.highestPay)}
        />
        <Stat icon={Building2} label="Companies" value={String(totals.companies)} />
      </dl>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col-reverse rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
      <dt className="text-brand-100 mt-0.5 flex items-center gap-1.5 text-xs">
        <Icon className="text-brand-200 size-3.5" aria-hidden />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="text-xl font-bold whitespace-nowrap tabular-nums sm:text-2xl">
        {value}
        {note && <span className="text-brand-200 ml-1.5 text-sm font-medium">{note}</span>}
      </dd>
    </div>
  );
}

function Title({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Icon className="text-brand-700 dark:text-brand-300 size-4.5" aria-hidden />
        {title}
      </h2>
      {description && <p className="text-sm text-slate-500">{description}</p>}
    </div>
  );
}

const value = (measure: PlacementMeasure | undefined, number: number | null | undefined) =>
  number == null ? '—' : `${Number(number.toFixed(1))}${measure?.unit ?? ''}`;

/** A rate bar: 0–100. */
function Bar({
  pct,
  color = BRAND,
  className,
}: {
  pct: number | null;
  color?: string;
  className?: string;
}) {
  return (
    <span className={cn('block h-2 overflow-hidden rounded-full bg-slate-100', className)}>
      <span
        className="block h-full rounded-full transition-all"
        style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%`, background: color }}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------------------------

/** Placed against not-yet-placed on each measure, and the placement rate by quarter. */
function Prep({
  data,
  measureOf,
  pay,
}: {
  data: PlacementsResponse;
  measureOf: Record<string, PlacementMeasure>;
  pay: (value: number | null) => string;
}) {
  const word = data.kind === 'full-time' ? 'placed' : 'with an internship';
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={TrendingUp}
        title="Does Preparation Pay Off?"
        description={`Students ${word} against those still waiting, and how often each quarter of the batch got an offer.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {data.prep.map((row) => {
          const measure = measureOf[row.key];
          const top = Math.max(row.placedAvg ?? 0, row.othersAvg ?? 0) || 1;
          const scale = measure?.unit === '%' ? 100 : top;
          const best = Math.max(...row.bands.map((band) => band.rate ?? 0), 1);
          const lift =
            row.bands.length === 4 && row.bands[0].rate != null && row.bands[3].rate != null
              ? row.bands[3].rate - row.bands[0].rate
              : null;
          return (
            <div key={row.key} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold">{measure?.label ?? row.key}</p>
              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 first-letter:uppercase">{word}</span>
                    <span className="font-bold tabular-nums">{value(measure, row.placedAvg)}</span>
                  </div>
                  <Bar pct={((row.placedAvg ?? 0) / scale) * 100} className="mt-1" />
                </div>
                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Still waiting</span>
                    <span className="font-bold tabular-nums">{value(measure, row.othersAvg)}</span>
                  </div>
                  <Bar
                    pct={((row.othersAvg ?? 0) / scale) * 100}
                    color="#94a3b8"
                    className="mt-1"
                  />
                </div>
              </div>
              {row.bands.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-medium text-slate-500">
                    Offer rate by quarter of the batch
                  </p>
                  <div className="mt-1.5 flex h-16 items-end gap-1.5">
                    {row.bands.map((band, index) => (
                      <div
                        key={band.label}
                        className="flex flex-1 flex-col items-center justify-end"
                        title={`${band.label}: ${value(measure, band.from)}–${value(measure, band.to)}. ${band.placed} of ${band.students} got an offer${band.medianPay != null ? `, median ${pay(band.medianPay)}` : ''}.`}
                      >
                        <span className="text-[10px] font-semibold tabular-nums">
                          {band.rate ?? 0}%
                        </span>
                        <span
                          className="w-full rounded-t-md"
                          style={{
                            height: `${Math.max(4, ((band.rate ?? 0) / best) * 44)}px`,
                            background: BRAND,
                            opacity: 0.35 + index * 0.2,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                    <span>Lowest</span>
                    <span>Highest</span>
                  </div>
                  {lift != null && (
                    <p
                      className={cn(
                        'mt-2 text-xs font-medium',
                        lift > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                      )}
                    >
                      {lift > 0
                        ? `Top quarter: ${Number(lift.toFixed(1))} points more likely`
                        : 'No clear link yet'}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Campuses({
  data,
  pay,
  onPick,
}: {
  data: PlacementsResponse;
  pay: (value: number | null) => string;
  onPick: (id: number | null) => void;
}) {
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Building2}
        title="By Campus"
        description="Share of in-season students with an offer."
      />
      <ul className="max-h-[30rem] space-y-2.5 overflow-y-auto pr-1">
        {data.byCampus.map((row) => (
          <li key={row.id ?? row.name}>
            <button
              type="button"
              onClick={() => row.id !== null && onPick(row.id)}
              className="hover:bg-brand-50/60 dark:hover:bg-brand-900/30 w-full rounded-lg px-2 py-1.5 text-left"
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{row.name}</span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                  {row.placed}/{row.students} ·{' '}
                  <b className="text-slate-800 dark:text-slate-100">{row.rate ?? 0}%</b>
                  {row.medianPay != null && <> · {pay(row.medianPay)}</>}
                </span>
              </div>
              <Bar pct={row.rate} className="mt-1" />
            </button>
          </li>
        ))}
      </ul>
      {data.batches.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3 text-xs">
          {data.batches.map((batch) => (
            <span
              key={`${batch.program}${batch.year}`}
              className="rounded-full bg-slate-100 px-2.5 py-1"
            >
              {cohortLabel(batch.program, String(batch.year))}: <b>{batch.rate ?? 0}%</b> (
              {batch.placed}/{batch.students})
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Cohorts({
  data,
  pay,
}: {
  data: PlacementsResponse;
  pay: (value: number | null) => string;
}) {
  if (!data.cohorts.length) return null;
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Crown}
        title="Cohorts"
        description="The LMS cohorts (Super 100 and others) against everyone else."
      />
      <ul className="space-y-3">
        {data.cohorts.map((row) => {
          const gold = /super[\s-]*100|pinnacle/i.test(row.cohort);
          return (
            <li key={row.cohort}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={cn('truncate font-medium', gold && 'text-[#a8741f]')}>
                  {row.cohort}
                </span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                  {row.placed}/{row.students} ·{' '}
                  <b className="text-slate-800 dark:text-slate-100">{row.rate ?? 0}%</b>
                  {row.medianPay != null && <> · median {pay(row.medianPay)}</>}
                </span>
              </div>
              <Bar pct={row.rate} color={gold ? '#c8913a' : BRAND} className="mt-1" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Fit({
  data,
  measureOf,
  pay,
}: {
  data: PlacementsResponse;
  measureOf: Record<string, PlacementMeasure>;
  pay: (value: number | null) => string;
}) {
  if (!data.fit) return null;
  if (Array.isArray(data.fit)) {
    const groups = data.fit as RoleGroup[];
    return (
      <section className={cn(panel, 'p-5')}>
        <Title
          icon={Target}
          title="Tech Roles and Other Roles"
          description="Who got tech jobs (IT, software, engineering) and how they practised, against everyone placed elsewhere."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <div key={group.group} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold">{group.group}</p>
                <p className="text-sm text-slate-500">
                  {group.offers} offers
                  {group.medianPay != null && <> · median {pay(group.medianPay)}</>}
                </p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {data.measures.map((m) => (
                  <div
                    key={m.key}
                    className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/40"
                  >
                    <dt className="truncate text-[11px] text-slate-500">{m.label}</dt>
                    <dd
                      className={cn(
                        'font-bold tabular-nums',
                        m.unit === '%' && scoreTone(group.measures[m.key])
                      )}
                    >
                      {value(measureOf[m.key], group.measures[m.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    );
  }
  const fit = data.fit as FitMatrix;
  if (!fit.rows.length) return null;
  const max = Math.max(1, ...fit.rows.flatMap((row) => Object.values(row.cells)));
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Target}
        title="Domain Studied, Job Taken"
        description="Each student's PRIME domain against the kind of role they were selected for. Highlighted cells are a match."
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
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
            {fit.rows.map((row) => (
              <tr key={row.domain} className="border-t border-slate-200">
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {row.domain}
                  <span className="ml-1 text-xs font-normal text-slate-400">({row.offers})</span>
                </th>
                {fit.columns.map((column) => {
                  const count = row.cells[column] ?? 0;
                  const match = column === row.domain;
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Roles({ data, pay }: { data: PlacementsResponse; pay: (value: number | null) => string }) {
  const max = Math.max(1, ...data.roles.map((row) => row.offers));
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={BriefcaseBusiness}
        title="Roles"
        description="The LMS role category of each offer."
      />
      <ul className="space-y-2">
        {data.roles.slice(0, 10).map((row) => (
          <li key={row.category}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{row.category}</span>
              <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                <b className="text-slate-800 dark:text-slate-100">{row.offers}</b>
                {row.medianPay != null && <> · {pay(row.medianPay)}</>}
              </span>
            </div>
            <Bar pct={(row.offers / max) * 100} className="mt-1" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Companies({
  data,
  pay,
}: {
  data: PlacementsResponse;
  pay: (value: number | null) => string;
}) {
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Building2}
        title="Top Companies"
        description="By number of offers, with the median pay."
      />
      <ol className="divide-y divide-slate-100 text-sm">
        {data.companies.map((row, index) => (
          <li key={row.company} className="flex items-center gap-3 py-1.5">
            <span className="w-5 text-xs text-slate-400 tabular-nums">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{row.company}</span>
            <span className="text-xs text-slate-500 tabular-nums">
              {row.offers} offer{row.offers === 1 ? '' : 's'}
            </span>
            <span className="w-24 text-right text-xs font-semibold tabular-nums">
              {pay(row.medianPay)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const JOINING_COLORS: Record<string, string> = {
  '1': '#10b981',
  '3': '#f59e0b',
  unknown: '#cbd5e1',
  withdrawn: '#ef4444',
};

function Joining({ data }: { data: PlacementsResponse }) {
  const total = data.joining.reduce((sum, row) => sum + row.offers, 0) || 1;
  const color = (key: string) =>
    JOINING_COLORS[key] ?? (['2', '4', '5', '9', '10'].includes(key) ? '#fb7185' : '#a78bfa');
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={UserCheck}
        title="Joining"
        description={`${data.totals.joined} joined · ${data.totals.awaiting} awaited · ${data.totals.dropped} fell through`}
      />
      <div className="flex h-3 overflow-hidden rounded-full">
        {data.joining.map((row) => (
          <span
            key={row.key}
            style={{ width: `${(row.offers / total) * 100}%`, background: color(row.key) }}
            title={`${row.label}: ${row.offers}`}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        {data.joining.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: color(row.key) }}
            />
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            <b className="tabular-nums">{row.offers}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Months({ data }: { data: PlacementsResponse }) {
  const max = Math.max(1, ...data.months.map((row) => row.offers));
  const label = (month: string) =>
    new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', {
      month: 'short',
      year: '2-digit',
    });
  return (
    <section className={cn(panel, 'p-5')}>
      <Title icon={CalendarDays} title="Selections by Month" />
      <div className="flex h-40 items-end gap-1.5 overflow-x-auto pb-1">
        {data.months.map((row) => (
          <div
            key={row.month}
            className="flex min-w-8 flex-1 flex-col items-center justify-end gap-1"
            title={`${label(row.month)}: ${row.offers}`}
          >
            <span className="text-[10px] font-semibold tabular-nums">{row.offers}</span>
            <span
              className="w-full rounded-t-md"
              style={{ height: `${(row.offers / max) * 110}px`, background: BRAND }}
            />
            <span className="text-[10px] whitespace-nowrap text-slate-500">{label(row.month)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionLists({
  data,
  studentLink,
}: {
  data: PlacementsResponse;
  studentLink: StudentLink;
}) {
  const [tab, setTab] = useState<'ready' | 'help'>('ready');
  const list = tab === 'ready' ? data.ready : data.needHelp;
  const measures = data.measures;
  return (
    <section className={cn(panel, 'p-5')}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Title
          icon={tab === 'ready' ? Sparkles : AlertTriangle}
          title={tab === 'ready' ? 'Ready, No Offer Yet' : 'Needs Help Now'}
          description={
            tab === 'ready'
              ? 'The best-prepared students still without an offer: put them in front of companies first.'
              : 'The weakest preparation and no offer yet: they need attention before the next drives.'
          }
        />
        <div className="flex rounded-full bg-slate-100 p-1 text-sm">
          {(['ready', 'help'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={tab === option}
              onClick={() => setTab(option)}
              className={cn(
                'rounded-full px-3 py-1 font-medium',
                tab === option ? 'bg-surface text-brand-700 shadow' : 'text-slate-600'
              )}
            >
              {option === 'ready' ? 'Ready' : 'Needs Help'}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        Readiness is the average of{' '}
        {measures
          .filter((m) => m.readiness)
          .map((m) => m.label)
          .join(', ')}
        .
      </p>
      <StudentTable rows={list} measures={measures} studentLink={studentLink} />
    </section>
  );
}

function StudentTable({
  rows,
  measures,
  studentLink,
}: {
  rows: PlacementStudent[];
  measures: PlacementMeasure[];
  studentLink: StudentLink;
}) {
  if (!rows.length)
    return <p className="py-6 text-center text-sm text-slate-500">No students here.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-2 pr-3 font-semibold">Student</th>
            <th className="px-2 py-2 text-right font-semibold">Readiness</th>
            {measures.map((m) => (
              <th key={m.key} className="px-2 py-2 text-right font-semibold">
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3">
                {studentLink(
                  row.slug,
                  <span className="text-brand-700 dark:text-brand-300 font-semibold hover:underline">
                    {row.name}
                  </span>
                )}
                {row.super100 && (
                  <Crown className="ml-1 inline size-3 text-[#c8913a]" aria-label="Super 100" />
                )}
                <div className="text-xs text-slate-500">
                  {row.campus} · {cohortLabel(row.program, String(row.year))}
                </div>
              </td>
              <td
                className={cn(
                  'px-2 py-2 text-right font-bold tabular-nums',
                  scoreTone(row.readiness)
                )}
              >
                {row.readiness ?? '—'}
              </td>
              {measures.map((m) => (
                <td
                  key={m.key}
                  className={cn(
                    'px-2 py-2 text-right tabular-nums',
                    m.unit === '%' && scoreTone(row.measures[m.key])
                  )}
                >
                  {value(m, row.measures[m.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Offers({
  data,
  pay,
  studentLink,
}: {
  data: PlacementsResponse;
  pay: (value: number | null) => string;
  studentLink: StudentLink;
}) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(40);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? data.offers.filter((row) =>
          [row.name, row.company, row.designation, row.category, row.campus]
            .filter(Boolean)
            .some((text) => String(text).toLowerCase().includes(needle))
        )
      : data.offers;
  }, [data.offers, q]);
  const fullTime = data.kind === 'full-time';
  return (
    <section className={cn(panel, 'p-5')}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Title
          icon={Award}
          title={fullTime ? 'Every Offer' : 'Every Internship'}
          description={data.showPay ? undefined : 'Pay is shown as averages only for campus teams.'}
        />
        <label className="relative">
          <Search
            className="pointer-events-none absolute top-2 left-2.5 size-4 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search name, company or role"
            className="bg-surface w-64 rounded-full border border-slate-300 py-1.5 pr-3 pl-8 text-sm"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-semibold">Student</th>
              <th className="px-2 py-2 font-semibold">Company and Role</th>
              {data.showPay && (
                <th className="px-2 py-2 text-right font-semibold">
                  {fullTime ? 'CTC' : 'Stipend'}
                </th>
              )}
              <th className="px-2 py-2 font-semibold">Selected</th>
              <th className="px-2 py-2 font-semibold">Joining</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((row, index) => (
              <tr
                key={`${row.slug}-${row.company}-${index}`}
                className="border-b border-slate-100 last:border-0"
              >
                <td className="py-2 pr-3">
                  {studentLink(
                    row.slug,
                    <span className="text-brand-700 dark:text-brand-300 font-semibold hover:underline">
                      {row.name}
                    </span>
                  )}
                  {row.super100 && (
                    <Crown className="ml-1 inline size-3 text-[#c8913a]" aria-label="Super 100" />
                  )}
                  <div className="text-xs text-slate-500">
                    {row.campus} · {cohortLabel(row.program, String(row.year))}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="font-medium">{row.company ?? '—'}</div>
                  <div className="text-xs text-slate-500">
                    {[row.designation, row.category].filter(Boolean).join(' · ')}
                    {!fullTime && row.months ? ` · ${row.months} months` : ''}
                  </div>
                </td>
                {data.showPay && (
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">
                    {pay(row.pay)}
                  </td>
                )}
                <td className="px-2 py-2 text-xs whitespace-nowrap text-slate-600">
                  {row.selectedOn
                    ? new Date(`${row.selectedOn}T00:00:00`).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-2 py-2 text-xs">
                  <JoiningTag label={row.joining} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setLimit((current) => current + 100)}
            className="text-brand-700 rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold"
          >
            Show More ({rows.length - limit} left)
          </button>
        </div>
      )}
    </section>
  );
}

export function JoiningTag({ label }: { label: string | null }) {
  if (!label) return <span className="text-slate-400">Not updated</span>;
  const tone = /^Joined, working/.test(label)
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : /awaited/i.test(label)
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  return (
    <span className={cn('inline-block rounded-full px-2 py-0.5 font-medium', tone)}>{label}</span>
  );
}
