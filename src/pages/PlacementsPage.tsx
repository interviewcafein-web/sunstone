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

import { DownloadAll, ExportButtons } from '@/components/common/ExportButtons';
import { PageLoader } from '@/components/common/PageLoader';
import { scoreTone } from '@/lib/assessments';
import { cohortLabel } from '@/lib/cohorts';
import type { ExportColumn, ExportSheet } from '@/lib/exportTable';
import {
  ROLE_LABELS,
  formatPay,
  type FitMatrix,
  type PlacementKind,
  type PlacementOffer,
  type PlacementSegment,
  type PlacementsSearch,
  type PlacementMeasure,
  type PlacementStudent,
  type PlacementsResponse,
  type RoleGroup,
  type SegmentSummary,
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
  const query = usePlacements(kind, {
    campus: search.campus,
    batch: search.batch,
    segment: search.segment,
  });
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
  const sheets = sheetsFor(data);
  const scope = [
    search.campus
      ? (data.campuses.find((campus) => campus.id === search.campus)?.name ?? 'campus')
      : 'all-campuses',
    search.batch && batchName(search.batch),
    search.segment && `${search.segment}-jobs`,
  ]
    .filter(Boolean)
    .join('-');
  const file: FileName = (part) => `placements-${kind}-${part}-${scope}`;

  return (
    <div className="space-y-6">
      <Hero
        data={data}
        kind={kind}
        search={search}
        setSearch={setSearch}
        pay={pay}
        fetching={query.isFetching}
        sheets={sheets}
        file={file}
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
          {data.segments && (
            <Segments
              data={data}
              segments={data.segments}
              measureOf={measureOf}
              pay={pay}
              segment={search.segment}
              setSegment={(segment) => setSearch({ segment })}
              sheets={sheets}
              file={file}
            />
          )}
          <Prep data={data} measureOf={measureOf} pay={pay} sheets={sheets} file={file} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Campuses
              data={data}
              pay={pay}
              batch={search.batch}
              onPick={(id) => setSearch({ campus: id ?? undefined, batch: undefined })}
              onBatch={(batch) => setSearch({ batch })}
              sheets={sheets}
              file={file}
            />
            <Cohorts data={data} pay={pay} sheets={sheets} file={file} />
          </div>
          <Fit data={data} measureOf={measureOf} pay={pay} sheets={sheets} file={file} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Roles data={data} pay={pay} sheets={sheets} file={file} />
            <Companies data={data} pay={pay} sheets={sheets} file={file} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Joining data={data} sheets={sheets} file={file} />
            <Months data={data} sheets={sheets} file={file} />
          </div>
          <ActionLists data={data} studentLink={studentLink} sheets={sheets} file={file} />
          <Offers data={data} pay={pay} studentLink={studentLink} file={file} />
        </>
      )}
    </div>
  );
}

// --- Downloads -------------------------------------------------------------------------------

type FileName = (part: string) => string;
type Sheets = ReturnType<typeof sheetsFor>;

/** "MBA:2025" → "MBA 2025–27". */
const batchName = (batch: string) => {
  const [program, year] = batch.split(':');
  return cohortLabel(program, year);
};

const payHeader = (fullTime: boolean) => (fullTime ? 'CTC (LPA)' : 'Stipend (₹/month)');
const rangeOf = (measure: PlacementMeasure | undefined, from: number, to: number) =>
  `${value(measure, from)}–${value(measure, to)}`;

function measureColumns<T extends { measures: Record<string, number | null> }>(
  measures: PlacementMeasure[],
  prefix = ''
): ExportColumn<T>[] {
  return measures.map((m) => ({
    header: `${prefix}${m.label}${m.unit === '%' ? ' %' : ''}`,
    value: (row) => row.measures[m.key],
  }));
}

function studentColumns(measures: PlacementMeasure[]): ExportColumn<PlacementStudent>[] {
  return [
    { header: 'Student', value: (row) => row.name },
    { header: 'Campus', value: (row) => row.campus },
    { header: 'Program', value: (row) => row.program },
    { header: 'Batch', value: (row) => cohortLabel(row.program, row.year) },
    { header: 'Super 100', value: (row) => (row.super100 ? 'Yes' : '') },
    { header: 'Readiness', value: (row) => row.readiness },
    ...measureColumns<PlacementStudent>(measures),
  ];
}

/** Every offer, as the Every Offer table and its download show it. */
export function offerColumns(data: PlacementsResponse): ExportColumn<PlacementOffer>[] {
  const fullTime = data.kind === 'full-time';
  return [
    { header: 'Student', value: (row) => row.name },
    { header: 'Campus', value: (row) => row.campus },
    { header: 'Program', value: (row) => row.program },
    { header: 'Batch', value: (row) => cohortLabel(row.program, row.year) },
    { header: 'Company', value: (row) => row.company },
    { header: 'Designation', value: (row) => row.designation },
    { header: 'Role category', value: (row) => row.category },
    ...(data.segments
      ? [{ header: 'Sales or Core', value: (row: PlacementOffer) => row.segment ?? null }]
      : []),
    ...(data.showPay
      ? [{ header: payHeader(fullTime), value: (row: PlacementOffer) => row.pay }]
      : []),
    ...(fullTime ? [] : [{ header: 'Months', value: (row: PlacementOffer) => row.months }]),
    { header: 'Selected on', value: (row) => row.selectedOn },
    { header: 'Joining', value: (row) => row.joining },
    { header: 'CRC', value: (row) => row.crc },
  ];
}

/** One downloadable table per section of the page (and all of them for Download All). */
function sheetsFor(data: PlacementsResponse) {
  const fullTime = data.kind === 'full-time';
  const payH = payHeader(fullTime);
  const word = fullTime ? 'Placed' : 'With an internship';
  const measureOf = Object.fromEntries(data.measures.map((m) => [m.key, m]));
  const groupColumns = <T extends { students: number; placed: number; rate: number | null }>(
    first: ExportColumn<T>
  ): ExportColumn<T & { medianPay: number | null; highestPay: number | null }>[] => [
    first as ExportColumn<T & { medianPay: number | null; highestPay: number | null }>,
    { header: 'Students in season', value: (row) => row.students },
    { header: word, value: (row) => row.placed },
    { header: `${word} %`, value: (row) => row.rate },
    { header: `Median ${payH}`, value: (row) => row.medianPay },
    { header: `Highest ${payH}`, value: (row) => row.highestPay },
  ];

  const segments: ExportSheet<SegmentSummary> | null = data.segments
    ? {
        sheet: 'Sales and Core',
        rows: data.segments,
        columns: [
          { header: 'Segment', value: (row) => row.label },
          { header: 'Offers', value: (row) => row.offers },
          { header: 'Students', value: (row) => row.students },
          { header: 'Share of batch %', value: (row) => row.rate },
          { header: `Median ${payH}`, value: (row) => row.medianPay },
          { header: `Highest ${payH}`, value: (row) => row.highestPay },
          { header: 'Companies', value: (row) => row.companies },
          { header: 'Joined', value: (row) => row.joined },
          ...measureColumns<SegmentSummary>(data.measures, 'Average '),
          {
            header: 'Top companies',
            value: (row) => row.topCompanies.map((c) => `${c.name} (${c.offers})`).join(', '),
          },
          {
            header: 'Role categories',
            value: (row) => row.categories.map((c) => `${c.name} (${c.offers})`).join(', '),
          },
        ],
      }
    : null;

  type Prep = PlacementsResponse['prep'][number];
  const prep: ExportSheet<Prep> = {
    sheet: 'Preparation',
    rows: data.prep,
    columns: [
      { header: 'Measure', value: (row) => measureOf[row.key]?.label ?? row.key },
      { header: `${word}: average`, value: (row) => row.placedAvg },
      { header: `${word}: students`, value: (row) => row.placedCount },
      { header: 'Still waiting: average', value: (row) => row.othersAvg },
      { header: 'Still waiting: students', value: (row) => row.othersCount },
      ...['Bottom', 'Second', 'Third', 'Top'].flatMap((label, index) => [
        {
          header: `${label} quarter: range`,
          value: (row: Prep) => {
            const band = row.bands[index];
            return band ? rangeOf(measureOf[row.key], band.from, band.to) : null;
          },
        },
        {
          header: `${label} quarter: offer rate %`,
          value: (row: Prep) => row.bands[index]?.rate ?? null,
        },
      ]),
    ],
  };

  type Campus = PlacementsResponse['byCampus'][number];
  const campuses: ExportSheet<Campus> = {
    sheet: 'By campus',
    rows: data.byCampus,
    columns: groupColumns<Campus>({ header: 'Campus', value: (row) => row.name }),
  };
  type Batch = PlacementsResponse['batches'][number];
  const batches: ExportSheet<Batch> = {
    sheet: 'By batch',
    rows: data.batches,
    columns: [
      { header: 'Program', value: (row) => row.program },
      ...groupColumns<Batch>({
        header: 'Batch',
        value: (row) => cohortLabel(row.program, row.year),
      }),
    ],
  };
  type Cohort = PlacementsResponse['cohorts'][number];
  const cohorts: ExportSheet<Cohort> = {
    sheet: 'Cohorts',
    rows: data.cohorts,
    columns: groupColumns<Cohort>({ header: 'Cohort', value: (row) => row.cohort }),
  };

  let fit: ExportSheet<any> | null = null;
  if (Array.isArray(data.fit)) {
    fit = {
      sheet: 'Tech and other roles',
      rows: data.fit as RoleGroup[],
      columns: [
        { header: 'Roles', value: (row: RoleGroup) => row.group },
        { header: 'Offers', value: (row: RoleGroup) => row.offers },
        { header: 'Students', value: (row: RoleGroup) => row.students },
        { header: `Median ${payH}`, value: (row: RoleGroup) => row.medianPay },
        ...measureColumns<RoleGroup>(data.measures, 'Average '),
      ],
    };
  } else if (data.fit) {
    const matrix = data.fit as FitMatrix;
    type FitRow = FitMatrix['rows'][number];
    fit = {
      sheet: 'Domain vs role',
      rows: matrix.rows,
      columns: [
        { header: 'PRIME domain', value: (row: FitRow) => row.domain },
        { header: 'Offers', value: (row: FitRow) => row.offers },
        { header: 'In their domain', value: (row: FitRow) => row.matched },
        { header: 'In their domain %', value: (row: FitRow) => row.rate },
        ...matrix.columns.map((column) => ({
          header: ROLE_LABELS[column] ?? column,
          value: (row: FitRow) => row.cells[column] ?? 0,
        })),
      ],
    };
  }

  type Role = PlacementsResponse['roles'][number];
  const roles: ExportSheet<Role> = {
    sheet: 'Roles',
    rows: data.roles,
    columns: [
      { header: 'Role category', value: (row) => row.category },
      { header: 'Offers', value: (row) => row.offers },
      { header: `Median ${payH}`, value: (row) => row.medianPay },
      ...measureColumns<Role>(data.measures, 'Average '),
    ],
  };
  type Company = PlacementsResponse['companies'][number];
  const companies: ExportSheet<Company> = {
    sheet: 'Top companies',
    rows: data.companies,
    columns: [
      { header: 'Company', value: (row) => row.company },
      { header: 'Offers', value: (row) => row.offers },
      { header: `Median ${payH}`, value: (row) => row.medianPay },
    ],
  };
  type JoiningRow = PlacementsResponse['joining'][number];
  const joining: ExportSheet<JoiningRow> = {
    sheet: 'Joining',
    rows: data.joining,
    columns: [
      { header: 'Joining status', value: (row) => row.label },
      { header: 'Offers', value: (row) => row.offers },
    ],
  };
  type Month = PlacementsResponse['months'][number];
  const months: ExportSheet<Month> = {
    sheet: 'Selections by month',
    rows: data.months,
    columns: [
      { header: 'Month', value: (row) => row.month },
      { header: 'Offers', value: (row) => row.offers },
    ],
  };
  const students = studentColumns(data.measures);
  const ready: ExportSheet<PlacementStudent> = {
    sheet: 'Ready, no offer yet',
    rows: data.ready,
    columns: students,
  };
  const needHelp: ExportSheet<PlacementStudent> = {
    sheet: 'Needs help now',
    rows: data.needHelp,
    columns: students,
  };
  const offers: ExportSheet<PlacementOffer> = {
    sheet: fullTime ? 'Every offer' : 'Every internship',
    rows: data.offers,
    columns: offerColumns(data),
  };
  return {
    segments,
    prep,
    campuses,
    batches,
    cohorts,
    fit,
    roles,
    companies,
    joining,
    months,
    ready,
    needHelp,
    offers,
  };
}

const allSheets = (sheets: Sheets): ExportSheet<any>[] =>
  Object.values(sheets).filter((sheet): sheet is ExportSheet<any> => sheet !== null);

// ---------------------------------------------------------------------------------------------

function Hero({
  data,
  kind,
  search,
  setSearch,
  pay,
  fetching,
  sheets,
  file,
}: {
  data: PlacementsResponse;
  kind: PlacementKind;
  search: PlacementsSearch;
  setSearch: (patch: Partial<PlacementsSearch>) => void;
  pay: (value: number | null) => string;
  fetching: boolean;
  sheets: Sheets;
  file: FileName;
}) {
  const { totals } = data;
  const fullTime = kind === 'full-time';
  const batches = data.batches.map((b) => cohortLabel(b.program, String(b.year))).join(', ');
  const batchOptions = data.batchOptions ?? [];
  const segmentLabel = data.segments?.find((entry) => entry.key === search.segment)?.label;
  const select =
    'max-w-56 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white [&>option]:text-slate-900';
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
            {fullTime ? 'Full-time job offers' : 'Internships'}
            {segmentLabel ? ` in ${segmentLabel.toLowerCase()} roles` : ''} from the LMS
            {search.batch
              ? ` for the ${batchName(search.batch)} batch`
              : batches
                ? ` for ${batches}`
                : ''}
            , set against how each student prepared.
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
          {data.segments && (
            <div
              className="flex rounded-full bg-white/10 p-1 text-sm"
              role="group"
              aria-label="Sales or core jobs"
            >
              {([undefined, 'sales', 'core'] as const).map((option) => (
                <button
                  key={option ?? 'all'}
                  type="button"
                  aria-pressed={search.segment === option}
                  onClick={() => setSearch({ segment: option })}
                  className={cn(
                    'rounded-full px-3 py-1 font-medium transition',
                    search.segment === option
                      ? 'text-brand-800 bg-white shadow'
                      : 'text-white/80 hover:text-white'
                  )}
                >
                  {option === 'sales' ? 'Sales' : option === 'core' ? 'Core' : 'All Jobs'}
                </button>
              ))}
            </div>
          )}
          {data.campuses.length > 1 && (
            <select
              aria-label="Campus"
              value={search.campus ?? ''}
              onChange={(event) =>
                setSearch({
                  campus: event.target.value ? Number(event.target.value) : undefined,
                  batch: undefined,
                })
              }
              className={select}
            >
              <option value="">All Campuses</option>
              {data.campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          )}
          {(batchOptions.length > 1 || search.batch) && (
            <select
              aria-label="Batch"
              value={search.batch ?? ''}
              onChange={(event) => setSearch({ batch: event.target.value || undefined })}
              className={select}
            >
              <option value="">All Batches</option>
              {search.batch && !batchOptions.some((option) => option.key === search.batch) && (
                <option value={search.batch}>{batchName(search.batch)}</option>
              )}
              {batchOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {cohortLabel(option.program, String(option.year))} ({option.students})
                </option>
              ))}
            </select>
          )}
          <DownloadAll name={file('all')} sheets={() => allSheets(sheets)} />
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
  aside,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Right of the title: downloads, toggles. */
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
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

const SEGMENT_STYLE: Record<
  PlacementSegment,
  { box: string; text: string; ring: string; bar: string; tag: string }
> = {
  sales: {
    box: 'border-amber-300 bg-amber-50/60 dark:border-amber-700/60 dark:bg-amber-900/15',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-2 ring-amber-400',
    bar: '#f59e0b',
    tag: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  core: {
    box: 'border-brand-300 bg-brand-50/60 dark:border-brand-700/60 dark:bg-brand-900/20',
    text: 'text-brand-700 dark:text-brand-300',
    ring: 'ring-brand-400 ring-2',
    bar: BRAND,
    tag: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  },
};

function SegmentTag({ segment }: { segment: 'Sales' | 'Core' }) {
  const style = SEGMENT_STYLE[segment === 'Sales' ? 'sales' : 'core'];
  return (
    <span
      className={cn(
        'mr-1.5 inline-block rounded-full px-1.5 py-px text-[10px] font-semibold',
        style.tag
      )}
    >
      {segment}
    </span>
  );
}

/** Converge: sales jobs against core jobs, and how the students who got each prepared. */
function Segments({
  data,
  segments,
  measureOf,
  pay,
  segment,
  setSegment,
  sheets,
  file,
}: {
  data: PlacementsResponse;
  segments: SegmentSummary[];
  measureOf: Record<string, PlacementMeasure>;
  pay: (value: number | null) => string;
  segment?: PlacementSegment;
  setSegment: (segment: PlacementSegment | undefined) => void;
  sheets: Sheets;
  file: FileName;
}) {
  const fullTime = data.kind === 'full-time';
  const active = segments.find((entry) => entry.key === segment);
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={BriefcaseBusiness}
        title="Sales and Core Jobs"
        description={`${fullTime ? 'Job offers' : 'Internships'} in sales roles against core roles, and how the students who got them prepared.`}
        aside={
          sheets.segments && <ExportButtons name={file('sales-and-core')} {...sheets.segments} />
        }
      />
      {active && (
        <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/40">
          <span>
            The rest of this page shows <b>{active.label.toLowerCase()}</b> jobs only.
          </span>
          <button
            type="button"
            onClick={() => setSegment(undefined)}
            className="text-brand-700 rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold"
          >
            Show All Jobs
          </button>
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {segments.map((entry) => {
          const style = SEGMENT_STYLE[entry.key];
          const picked = segment === entry.key;
          const maxCategory = Math.max(1, ...entry.categories.map((row) => row.offers));
          return (
            <div
              key={entry.key}
              className={cn(
                'rounded-xl border p-4 transition',
                style.box,
                picked && style.ring,
                segment && !picked && 'opacity-60'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={cn('text-lg font-bold', style.text)}>{entry.label} Jobs</p>
                  <p className="text-xs text-slate-500">
                    {entry.offers.toLocaleString('en-IN')} offer{entry.offers === 1 ? '' : 's'} ·{' '}
                    {entry.students.toLocaleString('en-IN')} students ({entry.rate ?? 0}% of the
                    batch)
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() => setSegment(picked ? undefined : entry.key)}
                  className="bg-surface rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:border-slate-300"
                >
                  {picked ? 'Show All Jobs' : `Show Only ${entry.label}`}
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  [fullTime ? 'Median CTC' : 'Median Stipend', pay(entry.medianPay)],
                  [fullTime ? 'Highest CTC' : 'Highest Stipend', pay(entry.highestPay)],
                  ['Companies', String(entry.companies)],
                  ['Joined', String(entry.joined)],
                ].map(([label, shown]) => (
                  <div key={label} className="bg-surface rounded-lg px-2.5 py-2">
                    <dt className="truncate text-[11px] text-slate-500">{label}</dt>
                    <dd className="font-bold whitespace-nowrap tabular-nums">{shown}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Top Companies</p>
                  {entry.topCompanies.length ? (
                    <ol className="mt-1 space-y-1 text-sm">
                      {entry.topCompanies.map((row) => (
                        <li key={row.name} className="flex justify-between gap-2">
                          <span className="truncate">{row.name}</span>
                          <b className="tabular-nums">{row.offers}</b>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">None yet</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Role Categories</p>
                  <ul className="mt-1 space-y-1.5 text-sm">
                    {entry.categories.map((row) => (
                      <li key={row.name}>
                        <div className="flex justify-between gap-2">
                          <span className="truncate">{row.name}</span>
                          <b className="tabular-nums">{row.offers}</b>
                        </div>
                        <Bar
                          pct={(row.offers / maxCategory) * 100}
                          color={style.bar}
                          className="mt-0.5 h-1.5"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold text-slate-500">How They Prepared</p>
              <dl className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {data.measures.map((m) => (
                  <div key={m.key} className="bg-surface rounded-lg px-2.5 py-1.5">
                    <dt className="truncate text-[11px] text-slate-500">{m.label}</dt>
                    <dd
                      className={cn(
                        'font-bold tabular-nums',
                        m.unit === '%' && scoreTone(entry.measures[m.key])
                      )}
                    >
                      {value(measureOf[m.key], entry.measures[m.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Sales = the LMS role category Sales (business development, BDE, area sales). Core = every
        other category: marketing, operations, HR, finance, general management, research.
      </p>
    </section>
  );
}

/** Placed against not-yet-placed on each measure, and the offer rate by quarter. */
function Prep({
  data,
  measureOf,
  pay,
  sheets,
  file,
}: {
  data: PlacementsResponse;
  measureOf: Record<string, PlacementMeasure>;
  pay: (value: number | null) => string;
  sheets: Sheets;
  file: FileName;
}) {
  const word = data.kind === 'full-time' ? 'placed' : 'with an internship';
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={TrendingUp}
        title="Does Preparation Pay Off?"
        description={`Students ${word} against those still waiting, and how often each quarter of the batch got an offer.`}
        aside={<ExportButtons name={file('preparation')} {...sheets.prep} />}
      />
      <div
        className={cn(
          'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
          data.prep.length > 5 ? 'xl:grid-cols-6' : 'xl:grid-cols-5'
        )}
      >
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
  batch,
  onPick,
  onBatch,
  sheets,
  file,
}: {
  data: PlacementsResponse;
  pay: (value: number | null) => string;
  batch?: string;
  onPick: (id: number | null) => void;
  onBatch: (batch: string | undefined) => void;
  sheets: Sheets;
  file: FileName;
}) {
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Building2}
        title="By Campus"
        description="Share of in-season students with an offer. Pick a batch below to see it alone."
        aside={
          <ExportButtons name={file('by-campus')} {...sheets.campuses} more={[sheets.batches]} />
        }
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
      {(data.batches.length > 1 || batch) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3 text-xs">
          {data.batches.map((row) => {
            const key = `${row.program}:${row.year}`;
            const picked = batch === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={picked}
                onClick={() => onBatch(picked ? undefined : key)}
                className={cn(
                  'rounded-full px-2.5 py-1 transition',
                  picked
                    ? 'bg-brand-600 text-white'
                    : 'hover:bg-brand-50 dark:hover:bg-brand-900/30 bg-slate-100'
                )}
              >
                {cohortLabel(row.program, String(row.year))}: <b>{row.rate ?? 0}%</b> ({row.placed}/
                {row.students})
              </button>
            );
          })}
          {batch && (
            <button
              type="button"
              onClick={() => onBatch(undefined)}
              className="text-brand-700 rounded-full border border-slate-200 px-2.5 py-1 font-semibold"
            >
              All Batches
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Cohorts({
  data,
  pay,
  sheets,
  file,
}: {
  data: PlacementsResponse;
  pay: (value: number | null) => string;
  sheets: Sheets;
  file: FileName;
}) {
  if (!data.cohorts.length) return null;
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Crown}
        title="Cohorts"
        description="The LMS cohorts (Super 100 and others) against everyone else."
        aside={<ExportButtons name={file('cohorts')} {...sheets.cohorts} />}
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
  sheets,
  file,
}: {
  data: PlacementsResponse;
  measureOf: Record<string, PlacementMeasure>;
  pay: (value: number | null) => string;
  sheets: Sheets;
  file: FileName;
}) {
  if (!data.fit) return null;
  const download = sheets.fit && <ExportButtons name={file('role-fit')} {...sheets.fit} />;
  if (Array.isArray(data.fit)) {
    const groups = data.fit as RoleGroup[];
    return (
      <section className={cn(panel, 'p-5')}>
        <Title
          icon={Target}
          title="Tech Roles and Other Roles"
          description="Who got tech jobs (IT, software, engineering) and how they practised, against everyone placed elsewhere."
          aside={download}
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
        aside={download}
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Roles({
  data,
  pay,
  sheets,
  file,
}: {
  data: PlacementsResponse;
  pay: (value: number | null) => string;
  sheets: Sheets;
  file: FileName;
}) {
  const max = Math.max(1, ...data.roles.map((row) => row.offers));
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={BriefcaseBusiness}
        title="Roles"
        description="The LMS role category of each offer."
        aside={<ExportButtons name={file('roles')} {...sheets.roles} />}
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
  sheets,
  file,
}: {
  data: PlacementsResponse;
  pay: (value: number | null) => string;
  sheets: Sheets;
  file: FileName;
}) {
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Building2}
        title="Top Companies"
        description="By number of offers, with the median pay."
        aside={<ExportButtons name={file('top-companies')} {...sheets.companies} />}
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

function Joining({
  data,
  sheets,
  file,
}: {
  data: PlacementsResponse;
  sheets: Sheets;
  file: FileName;
}) {
  const total = data.joining.reduce((sum, row) => sum + row.offers, 0) || 1;
  const color = (key: string) =>
    JOINING_COLORS[key] ?? (['2', '4', '5', '9', '10'].includes(key) ? '#fb7185' : '#a78bfa');
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={UserCheck}
        title="Joining"
        description={`${data.totals.joined} joined · ${data.totals.awaiting} awaited · ${data.totals.dropped} fell through`}
        aside={<ExportButtons name={file('joining')} {...sheets.joining} />}
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

function Months({
  data,
  sheets,
  file,
}: {
  data: PlacementsResponse;
  sheets: Sheets;
  file: FileName;
}) {
  const max = Math.max(1, ...data.months.map((row) => row.offers));
  const label = (month: string) =>
    new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', {
      month: 'short',
      year: '2-digit',
    });
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={CalendarDays}
        title="Selections by Month"
        aside={<ExportButtons name={file('by-month')} {...sheets.months} />}
      />
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
  sheets,
  file,
}: {
  data: PlacementsResponse;
  studentLink: StudentLink;
  sheets: Sheets;
  file: FileName;
}) {
  const [tab, setTab] = useState<'ready' | 'help'>('ready');
  const sheet = tab === 'ready' ? sheets.ready : sheets.needHelp;
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
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons
            name={file(tab === 'ready' ? 'ready-no-offer' : 'needs-help')}
            {...sheet}
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
  file,
}: {
  data: PlacementsResponse;
  pay: (value: number | null) => string;
  studentLink: StudentLink;
  file: FileName;
}) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(40);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? data.offers.filter((row) =>
          [row.name, row.company, row.designation, row.category, row.campus, row.segment]
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
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons
            name={file(fullTime ? 'every-offer' : 'every-internship')}
            sheet={fullTime ? 'Every offer' : 'Every internship'}
            columns={offerColumns(data)}
            rows={rows}
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
              className="bg-surface w-64 max-w-full rounded-full border border-slate-300 py-1.5 pr-3 pl-8 text-sm"
            />
          </label>
        </div>
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
                    {row.segment && <SegmentTag segment={row.segment} />}
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
