import { useMemo, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  Code2,
  Info,
  NotebookPen,
  Radar as RadarIcon,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { PageLoader } from '@/components/common/PageLoader';
import { Sparkline } from '@/components/common/Sparkline';
import { queryKeyFor } from '@/hooks/useStudentSummaries';
import { useStudents } from '@/hooks/useStudents';
import { useStudentMetrics } from '@/lib/assessments';
import type { PlatformSummary } from '@/lib/coding-profiles/summaries';
import {
  BAND_COLORS,
  DIMENSIONS,
  bandOf,
  buildInsights,
  findPainPoints,
  groupBy,
  groupStats,
  normalized,
  type Dimension,
  type DimensionId,
  type GroupStats,
  type PainPoint,
  type StudentInsight,
} from '@/lib/insights';
import { loadSummaries } from '@/lib/statsCache';
import { ZONES } from '@/lib/students/zones';
import { chartColors, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const route = getRouteApi('/insights');

const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';
const heroClass =
  'hero-glow from-brand-700 via-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7';

const ICONS: Record<DimensionId, LucideIcon> = {
  coding: Code2,
  attendance: CalendarCheck,
  tests: ClipboardCheck,
  amcat: Award,
  exams: NotebookPen,
};

const fmt = (dimension: Dimension, value: number | null) =>
  value === null ? '—' : `${value}${dimension.suffix}`;

export default function InsightsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const client = useQueryClient();
  const students = useStudents();
  const metrics = useStudentMetrics();
  // The saved coding numbers (the same query the students page uses, so usually cached).
  const saved = useQuery({
    queryKey: ['saved-summaries'],
    queryFn: ({ client: queryClient }) => loadSummaries(queryClient, queryKeyFor),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const all = useMemo(() => {
    if (!students.data) return [];
    return buildInsights(students.data.students, metrics.data?.students, (platform, handle) =>
      client.getQueryData<PlatformSummary>(queryKeyFor(platform, handle))
    );
    // saved.dataUpdatedAt: re-read the coding numbers once they are in the cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.data, metrics.data, saved.dataUpdatedAt, client]);

  const campuses = useMemo(
    () => [...new Set(all.map((row) => row.student.campus).filter(Boolean))].sort(),
    [all]
  );
  const inCampus = search.campus ? all.filter((row) => row.student.campus === search.campus) : all;
  const batches = [...new Set(inCampus.map((row) => row.student.batch).filter(Boolean))].sort();
  const scoped = search.batch
    ? inCampus.filter((row) => row.student.batch === search.batch)
    : inCampus;

  const overallStats = useMemo(() => groupStats('All campuses', all), [all]);
  const scopeName = [search.campus ?? 'All campuses', search.batch && `Batch ${search.batch}`]
    .filter(Boolean)
    .join(' · ');
  const scope = useMemo(() => groupStats(scopeName, scoped), [scopeName, scoped]);

  // Compare campuses when looking at all of them, otherwise the batches of the campus.
  const byCampus = !search.campus;
  const groups = useMemo(
    () =>
      groupBy(scoped, (row) => (byCampus ? row.student.campus : row.student.batch)).filter(
        (group) => group.students >= 5
      ),
    [scoped, byCampus]
  );
  const groupNoun = byCampus ? 'campuses' : 'batches';
  const pains = useMemo(() => findPainPoints(scope, groups, groupNoun), [scope, groups, groupNoun]);

  if (students.isPending || metrics.isPending) {
    return <PageLoader label="Building the 360° view…" variant="cards" />;
  }
  if (students.isError) {
    return <p className="text-sm text-red-600">{students.error.message}</p>;
  }

  const setScope = (next: { campus?: string; batch?: string }) =>
    navigate({ search: { campus: next.campus, batch: next.batch } });

  return (
    <div className="rise-stagger space-y-5">
      <section className={heroClass}>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-brand-200 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
              <RadarIcon className="size-3.5" aria-hidden />
              360° view
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{scopeName}</h1>
            <p className="text-brand-100 mt-2 max-w-2xl text-sm">
              Coding, attendance, PRIME tests, AMCAT and internal exams side by side for{' '}
              {scope.students.toLocaleString('en-IN')} students, with what needs attention first.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ScopeSelect
              label="Campus"
              value={search.campus ?? ''}
              options={campuses}
              all="All campuses"
              onChange={(campus) => setScope({ campus: campus || undefined })}
            />
            <ScopeSelect
              label="Batch"
              value={search.batch ?? ''}
              options={batches}
              all="All batches"
              onChange={(batch) => setScope({ campus: search.campus, batch: batch || undefined })}
            />
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-[auto_1fr]">
          <OverallBadge value={scope.overall} critical={scope.critical} students={scope.students} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {DIMENSIONS.map((dimension) => {
              const Icon = ICONS[dimension.id];
              const value = scope.dims[dimension.id].avg;
              return (
                <div
                  key={dimension.id}
                  className="hover-lift rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm"
                >
                  <p className="text-brand-100 flex items-center gap-1.5 text-xs">
                    <Icon className="text-brand-200 size-3.5" aria-hidden />
                    {dimension.short}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-2xl font-bold tabular-nums">
                    {fmt(dimension, value)}
                    <span
                      className="size-2 rounded-full"
                      style={{ background: BAND_COLORS[bandOf(dimension, value)] }}
                      aria-hidden
                    />
                  </p>
                  <p className="text-brand-200 text-[11px]">
                    {scope.dims[dimension.id].coverage}% have data
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {DIMENSIONS.map((dimension) => (
          <DimensionCard
            key={dimension.id}
            dimension={dimension}
            stats={scope}
            benchmark={search.campus ? overallStats : undefined}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <PainPoints points={pains} className="lg:col-span-3" />
        <ShapeRadar
          scope={scope}
          benchmark={search.campus ? overallStats : undefined}
          className="lg:col-span-2"
        />
      </div>

      {groups.length > 1 && (
        <ComparisonHeatmap
          groups={groups}
          noun={byCampus ? 'Campus' : 'Batch'}
          onPick={(key) =>
            byCampus ? setScope({ campus: key }) : setScope({ campus: search.campus, batch: key })
          }
        />
      )}

      <EngagementScatter rows={scoped} />

      <div className="grid gap-4 lg:grid-cols-5">
        <AttentionList rows={scoped} className="lg:col-span-3" />
        <StarsList rows={scoped} className="lg:col-span-2" />
      </div>
    </div>
  );
}

function ScopeSelect({
  label,
  value,
  options,
  all,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  all: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col text-[11px] font-medium text-white/70">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 max-w-56 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur focus-visible:outline-2 focus-visible:outline-white [&>option]:text-slate-900"
      >
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The big ring in the banner: mean of every student's overall score. */
function OverallBadge({
  value,
  critical,
  students,
}: {
  value: number | null;
  critical: number;
  students: number;
}) {
  const size = 92;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const color =
    value === null ? '#94a3b8' : value >= 70 ? '#34d399' : value >= 50 ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/10 p-3 pr-5 backdrop-blur-sm">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={46}
          cy={46}
          r={radius}
          fill="none"
          strokeWidth={8}
          stroke="rgb(255 255 255 / 0.15)"
        />
        <circle
          cx={46}
          cy={46}
          r={radius}
          fill="none"
          strokeWidth={8}
          strokeLinecap="round"
          stroke={color}
          className="ring-fill"
          strokeDasharray={`${((value ?? 0) / 100) * circumference} ${circumference}`}
          transform="rotate(-90 46 46)"
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="white"
          className="text-xl font-bold"
        >
          {value ?? '—'}
        </text>
      </svg>
      <div>
        <p className="text-sm font-semibold">Overall health</p>
        <p className="text-brand-100 text-xs">Average across all five fronts</p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#ef4444]/25 px-2 py-0.5 text-xs font-semibold text-[#fee2e2] ring-1 ring-[#fca5a5]/40">
          <AlertOctagon className="size-3.5" aria-hidden />
          {critical.toLocaleString('en-IN')} of {students.toLocaleString('en-IN')} at risk on 3+
        </p>
      </div>
    </div>
  );
}

/** One front: average, how students spread over it, and the good / ok / at-risk split. */
function DimensionCard({
  dimension,
  stats,
  benchmark,
}: {
  dimension: Dimension;
  stats: GroupStats;
  benchmark?: GroupStats;
}) {
  const Icon = ICONS[dimension.id];
  const own = stats.dims[dimension.id];
  const versus =
    benchmark && own.avg !== null && benchmark.dims[dimension.id].avg !== null
      ? own.avg - benchmark.dims[dimension.id].avg!
      : null;
  const peak = Math.max(1, ...own.histogram);
  const band = bandOf(dimension, own.avg);
  const buckets =
    dimension.id === 'coding'
      ? ['0–19', '20–39', '40–59', '60–79', '80+']
      : ['0–19', '20–39', '40–59', '60–79', '80–100'];

  return (
    <section className={cn(panel, 'hover-lift relative overflow-hidden p-4')}>
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${dimension.color}, ${dimension.color}33)` }}
      />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ background: `${dimension.color}1f`, color: dimension.color }}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            {dimension.label}
          </p>
        </div>
        <span title={dimension.measure}>
          <Info className="size-3.5 text-slate-300" aria-label={dimension.measure} />
        </span>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-bold tabular-nums" style={{ color: BAND_COLORS[band] }}>
          {fmt(dimension, own.avg)}
        </span>
        {dimension.id === 'coding' && own.avg !== null && (
          <span className="mb-1 text-xs text-slate-500">avg solved (capped at 100)</span>
        )}
        {versus !== null && versus !== 0 && (
          <span
            className={cn(
              'mb-1 inline-flex items-center text-xs font-semibold',
              versus > 0 ? 'text-emerald-600' : 'text-red-600'
            )}
            title="Compared with all campuses"
          >
            {versus > 0 ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {versus > 0 ? '+' : ''}
            {versus} vs all
          </span>
        )}
      </div>

      {/* How the students spread over the scale. */}
      <div
        className="mt-3 flex h-16 items-end gap-1"
        aria-label={`Distribution of ${dimension.label}`}
      >
        {own.histogram.map((count, index) => (
          <div key={index} className="group/bar flex h-full flex-1 flex-col justify-end">
            <div
              className="spark-draw rounded-t-md transition-all group-hover/bar:opacity-80"
              title={`${buckets[index]}: ${count} students`}
              style={{
                height: `${Math.max(4, (count / peak) * 100)}%`,
                background: `linear-gradient(180deg, ${dimension.color}, ${dimension.color}66)`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-slate-400">
        <span>low</span>
        <span>high</span>
      </div>

      <BandBar good={own.good} ok={own.ok} risk={own.risk} />
      <p className="mt-1.5 text-[11px] text-slate-500">
        {own.n.toLocaleString('en-IN')} students with data · {own.coverage}% coverage
      </p>
    </section>
  );
}

function BandBar({ good, ok, risk }: { good: number; ok: number; risk: number }) {
  const total = good + ok + risk || 1;
  const parts = [
    { label: 'Doing well', value: good, color: BAND_COLORS.good },
    { label: 'Average', value: ok, color: BAND_COLORS.ok },
    { label: 'At risk', value: risk, color: BAND_COLORS.risk },
  ];
  return (
    <div className="mt-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {parts.map((part) => (
          <span
            key={part.label}
            title={`${part.label}: ${part.value}`}
            className="h-full transition-[width] duration-700"
            style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-medium tabular-nums">
        {parts.map((part) => (
          <span key={part.label} style={{ color: part.color }}>
            {Math.round((part.value / total) * 100)}% {part.label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

const SEVERITY = {
  high: {
    icon: AlertOctagon,
    chip: 'bg-red-50 text-red-700 ring-red-200',
    label: 'High',
    bar: '#ef4444',
  },
  medium: {
    icon: AlertTriangle,
    chip: 'bg-amber-50 text-amber-700 ring-amber-200',
    label: 'Medium',
    bar: '#f59e0b',
  },
  low: {
    icon: Info,
    chip: 'bg-slate-100 text-slate-600 ring-slate-200',
    label: 'Low',
    bar: '#94a3b8',
  },
} as const;

function PainPoints({ points, className }: { points: PainPoint[]; className?: string }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? points : points.slice(0, 6);
  return (
    <section className={cn(panel, 'p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <AlertTriangle className="size-5 text-amber-500" aria-hidden />
          Pain points
        </h2>
        <span className="text-xs text-slate-500">Most pressing first</span>
      </div>
      {points.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-emerald-700">
          <Sparkles className="size-4" aria-hidden />
          Nothing stands out. Every front looks healthy here.
        </p>
      ) : (
        <ol className="rise-stagger mt-4 space-y-2.5">
          {shown.map((point, index) => {
            const severity = SEVERITY[point.severity];
            const Icon = point.dimension ? ICONS[point.dimension] : Users;
            const color = point.dimension
              ? DIMENSIONS.find((d) => d.id === point.dimension)!.color
              : '#64748b';
            return (
              <li
                key={index}
                className="relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 p-3 pl-4"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ background: severity.bar }}
                />
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${color}1f`, color }}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{point.title}</p>
                  <p className="text-xs text-slate-500">{point.detail}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                    severity.chip
                  )}
                >
                  {severity.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {points.length > 6 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-brand-700 dark:text-brand-300 mt-3 text-xs font-semibold hover:underline"
        >
          {showAll ? 'Show fewer' : `Show all ${points.length}`}
        </button>
      )}
    </section>
  );
}

/** The scope's five fronts on one radar, over the all-campus shape when a campus is picked. */
function ShapeRadar({
  scope,
  benchmark,
  className,
}: {
  scope: GroupStats;
  benchmark?: GroupStats;
  className?: string;
}) {
  const colors = chartColors(useTheme());
  const data = DIMENSIONS.map((dimension) => ({
    front: dimension.short,
    scope:
      scope.dims[dimension.id].avg === null
        ? 0
        : normalized(dimension, scope.dims[dimension.id].avg!),
    all:
      benchmark && benchmark.dims[dimension.id].avg !== null
        ? normalized(dimension, benchmark.dims[dimension.id].avg!)
        : undefined,
  }));
  return (
    <section className={cn(panel, 'p-5', className)}>
      <h2 className="text-lg font-bold">Strengths at a glance</h2>
      <p className="text-sm text-slate-500">
        The fuller the shape, the healthier.{benchmark ? ' Dashed: all campuses.' : ''}
      </p>
      <div className="mt-2 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="78%">
            <PolarGrid stroke={colors.grid} />
            <PolarAngleAxis dataKey="front" tick={{ fontSize: 12, fill: colors.tick }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {benchmark && (
              <Radar
                dataKey="all"
                stroke="#94a3b8"
                strokeDasharray="4 4"
                fill="#94a3b8"
                fillOpacity={0.08}
                isAnimationActive={false}
              />
            )}
            <Radar
              dataKey="scope"
              stroke="#3863a0"
              strokeWidth={2}
              fill="#3863a0"
              fillOpacity={0.28}
            />
            <Tooltip
              contentStyle={{
                background: colors.tooltip,
                border: `1px solid ${colors.grid}`,
                borderRadius: 12,
                color: colors.text,
                fontSize: 12,
              }}
              formatter={(value, key) => [value, key === 'all' ? 'All campuses' : scope.key]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type SortKey = 'overall' | 'students' | 'critical' | DimensionId;

/** Campuses (or batches) down the side, the five fronts across, each cell coloured by health. */
function ComparisonHeatmap({
  groups,
  noun,
  onPick,
}: {
  groups: GroupStats[];
  noun: string;
  onPick: (key: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>('overall');
  const valueOf = (group: GroupStats, key: SortKey) =>
    key === 'overall'
      ? group.overall
      : key === 'students'
        ? group.students
        : key === 'critical'
          ? (group.critical / group.students) * 100
          : group.dims[key].avg;
  const sorted = [...groups].sort((a, b) => {
    const x = valueOf(a, sort);
    const y = valueOf(b, sort);
    if (x === null) return 1;
    if (y === null) return -1;
    return sort === 'critical' ? x - y : y - x;
  });

  const header = (key: SortKey, label: string, title?: string) => (
    <th key={key} scope="col" className="px-2 py-2 font-medium">
      <button
        type="button"
        title={title}
        onClick={() => setSort(key)}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition hover:bg-slate-100',
          sort === key && 'text-brand-700 dark:text-brand-300 font-semibold'
        )}
      >
        {label}
        {sort === key && <span aria-hidden>↓</span>}
      </button>
    </th>
  );

  return (
    <section className={cn(panel, 'overflow-hidden')}>
      <div className="flex flex-wrap items-end justify-between gap-2 p-5 pb-3">
        <div>
          <h2 className="text-lg font-bold">{noun} comparison</h2>
          <p className="text-sm text-slate-500">
            Green is doing well, amber average, red at risk. Click a column to rank, a row to open
            it.
          </p>
        </div>
        <Legend />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50/80 text-center text-xs text-slate-600">
              <th scope="col" className="px-4 py-2 text-left font-medium">
                {noun}
              </th>
              {header('students', 'Students')}
              {header('overall', 'Overall')}
              {DIMENSIONS.map((dimension) =>
                header(dimension.id, dimension.short, dimension.measure)
              )}
              {header(
                'critical',
                'At risk 3+',
                'Share at risk on three fronts or more (fewest first)'
              )}
              <th scope="col" className="px-3 py-2 font-medium">
                Attendance, weekly
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((group, index) => (
              <tr
                key={group.key}
                onClick={() => onPick(group.key)}
                className={cn(
                  'animate-rise hover:bg-brand-50/60 cursor-pointer border-b border-slate-100 transition-colors last:border-0',
                  index % 2 === 1 && 'bg-slate-50/50'
                )}
                style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
              >
                <th scope="row" className="px-4 py-2.5 text-left font-semibold text-slate-800">
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-xs font-medium text-slate-400 tabular-nums">
                      {index + 1}
                    </span>
                    <span className="max-w-64 truncate" title={group.key}>
                      {group.key}
                    </span>
                    <ChevronRight className="size-3.5 text-slate-300" aria-hidden />
                  </span>
                </th>
                <td className="px-2 text-center text-slate-600 tabular-nums">
                  {group.students.toLocaleString('en-IN')}
                </td>
                <td className="px-2">
                  <HeatCell value={group.overall} color={overallColor(group.overall)} strong />
                </td>
                {DIMENSIONS.map((dimension) => {
                  const stats = group.dims[dimension.id];
                  return (
                    <td key={dimension.id} className="px-1.5">
                      <HeatCell
                        value={stats.avg}
                        suffix={dimension.suffix}
                        color={BAND_COLORS[bandOf(dimension, stats.avg)]}
                        note={stats.coverage < 60 ? `${stats.coverage}% data` : undefined}
                      />
                    </td>
                  );
                })}
                <td className="px-2 text-center">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                      group.critical / group.students >= 0.1
                        ? 'bg-red-50 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {Math.round((group.critical / group.students) * 100)}%
                  </span>
                </td>
                <td className="px-3">
                  {group.attendanceWeeks.length > 1 ? (
                    <Sparkline values={group.attendanceWeeks} width={96} height={24} />
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const overallColor = (value: number | null) =>
  value === null
    ? BAND_COLORS.none
    : value >= 70
      ? BAND_COLORS.good
      : value >= 50
        ? BAND_COLORS.ok
        : BAND_COLORS.risk;

function HeatCell({
  value,
  color,
  suffix = '',
  note,
  strong = false,
}: {
  value: number | null;
  color: string;
  suffix?: string;
  note?: string;
  strong?: boolean;
}) {
  if (value === null) {
    return <div className="rounded-lg py-2 text-center text-slate-300">—</div>;
  }
  return (
    <div
      className="rounded-lg px-2 py-1.5 text-center ring-1 transition group-hover:scale-105"
      style={{ background: `${color}1c`, color, ['--tw-ring-color' as string]: `${color}33` }}
    >
      <span
        className={cn('tabular-nums', strong ? 'text-base font-bold' : 'text-sm font-semibold')}
      >
        {value}
        {suffix}
      </span>
      {note && <span className="block text-[9px] font-medium opacity-70">{note}</span>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-slate-500">
      {(
        [
          ['good', 'Doing well'],
          ['ok', 'Average'],
          ['risk', 'At risk'],
        ] as const
      ).map(([band, label]) => (
        <span key={band} className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm" style={{ background: BAND_COLORS[band] }} />
          {label}
        </span>
      ))}
    </div>
  );
}

const SCATTER_LIMIT = 2500;

/** Attendance across, PRIME test score up, each dot coloured by the student's coding zone. */
function EngagementScatter({ rows }: { rows: StudentInsight[] }) {
  const colors = chartColors(useTheme());
  const placed = rows.filter((row) => row.scores.attendance !== null && row.scores.tests !== null);
  const sample =
    placed.length > SCATTER_LIMIT
      ? placed.filter((_, index) => index % Math.ceil(placed.length / SCATTER_LIMIT) === 0)
      : placed;
  const quadrant = (attendance: number, tests: number) =>
    attendance >= 75
      ? tests >= 50
        ? 'thriving'
        : 'struggling'
      : tests >= 50
        ? 'coasting'
        : 'disengaged';
  const counts = { thriving: 0, struggling: 0, coasting: 0, disengaged: 0 };
  for (const row of placed) counts[quadrant(row.scores.attendance!, row.scores.tests!)] += 1;
  const quadrants = [
    { id: 'thriving', label: 'Thriving', note: 'attend and score', color: '#10b981' },
    { id: 'struggling', label: 'Struggling', note: 'attend, but score low', color: '#f59e0b' },
    { id: 'coasting', label: 'Coasting', note: 'score, but skip class', color: '#3b82f6' },
    { id: 'disengaged', label: 'Disengaged', note: 'skip class and score low', color: '#ef4444' },
  ] as const;

  return (
    <section className={cn(panel, 'p-5')}>
      <h2 className="text-lg font-bold">Engagement map</h2>
      <p className="text-sm text-slate-500">
        Each dot is a student: attendance across, PRIME test average up, colour by coding zone.
        Lines at 75% attendance and 50% score.
      </p>
      <div className="mt-4 grid gap-5 lg:grid-cols-4">
        <div className="h-80 lg:col-span-3">
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
                name="Tests"
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 11, fill: colors.tick }}
              />
              <ZAxis range={[22, 22]} />
              <ReferenceLine x={75} stroke={colors.tick} strokeDasharray="4 4" />
              <ReferenceLine y={50} stroke={colors.tick} strokeDasharray="4 4" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  const point = payload?.[0]?.payload as
                    | { name: string; x: number; y: number; zone: string; campus: string }
                    | undefined;
                  if (!point) return null;
                  return (
                    <div
                      className="rounded-xl px-3 py-2 text-xs shadow-lg"
                      style={{
                        background: colors.tooltip,
                        color: colors.text,
                        border: `1px solid ${colors.grid}`,
                      }}
                    >
                      <p className="font-semibold">{point.name}</p>
                      <p className="opacity-70">{point.campus}</p>
                      <p className="mt-1">
                        Attendance {point.x}% · Tests {point.y}% · {point.zone}
                      </p>
                    </div>
                  );
                }}
              />
              {ZONES.map((zone) => (
                <Scatter
                  key={zone.id}
                  name={zone.label}
                  fill={zone.color}
                  fillOpacity={0.7}
                  isAnimationActive={false}
                  data={sample
                    .filter((row) => row.zone === zone.id)
                    .map((row) => ({
                      x: row.scores.attendance,
                      y: row.scores.tests,
                      name: row.student.name,
                      campus: row.student.campus,
                      zone: zone.label,
                    }))}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {quadrants.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: item.color }}
                >
                  <span className="size-2.5 rounded-full" style={{ background: item.color }} />
                  {item.label}
                </span>
                <span className="text-lg font-bold text-slate-800 tabular-nums">
                  {placed.length ? Math.round((counts[item.id] / placed.length) * 100) : 0}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {counts[item.id].toLocaleString('en-IN')} students · {item.note}
              </p>
            </div>
          ))}
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[10px] text-slate-500">
            {ZONES.map((zone) => (
              <span key={zone.id} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: zone.color }} />
                {zone.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreChips({ row }: { row: StudentInsight }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DIMENSIONS.map((dimension) => {
        const value = row.scores[dimension.id];
        const band = bandOf(dimension, value);
        const display = dimension.id === 'coding' && row.solved !== null ? row.solved : value;
        return (
          <span
            key={dimension.id}
            title={`${dimension.label}: ${display ?? 'no data'}`}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            style={{ background: `${BAND_COLORS[band]}1a`, color: BAND_COLORS[band] }}
          >
            {dimension.short} {display === null ? '—' : `${display}${dimension.suffix}`}
          </span>
        );
      })}
    </div>
  );
}

function StudentLine({ row, rank }: { row: StudentInsight; rank: number }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-2 w-5 text-right text-xs text-slate-400 tabular-nums">{rank}</span>
      <Avatar name={row.student.name} />
      <div className="min-w-0 flex-1">
        <Link
          to="/s/$slug"
          params={{ slug: row.student.slug }}
          className="text-brand-700 dark:text-brand-300 font-semibold hover:underline"
        >
          {row.student.name}
        </Link>
        <p className="truncate text-xs text-slate-500">
          {[row.student.campus, row.student.course, row.student.batch].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-1">
          <ScoreChips row={row} />
        </div>
      </div>
      <span
        className="mt-1 rounded-lg px-2 py-1 text-sm font-bold tabular-nums"
        style={{ background: `${overallColor(row.overall)}1c`, color: overallColor(row.overall) }}
        title="Overall score"
      >
        {row.overall ?? '—'}
      </span>
    </li>
  );
}

function AttentionList({ rows, className }: { rows: StudentInsight[]; className?: string }) {
  const [count, setCount] = useState(10);
  const flagged = rows
    .filter((row) => row.risks.length >= 2)
    .sort((a, b) => b.risks.length - a.risks.length || (a.overall ?? 100) - (b.overall ?? 100));
  return (
    <section className={cn(panel, 'p-5', className)}>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <AlertOctagon className="size-5 text-red-500" aria-hidden />
        Students who need attention
      </h2>
      <p className="text-sm text-slate-500">
        At risk on two fronts or more, most fronts first. {flagged.length.toLocaleString('en-IN')}{' '}
        students.
      </p>
      <ol className="mt-2 divide-y divide-slate-100">
        {flagged.slice(0, count).map((row, index) => (
          <StudentLine key={row.student.id} row={row} rank={index + 1} />
        ))}
      </ol>
      {flagged.length > count && (
        <button
          type="button"
          onClick={() => setCount(count + 20)}
          className="text-brand-700 dark:text-brand-300 mt-2 text-xs font-semibold hover:underline"
        >
          Show more ({(flagged.length - count).toLocaleString('en-IN')} left)
        </button>
      )}
    </section>
  );
}

function StarsList({ rows, className }: { rows: StudentInsight[]; className?: string }) {
  const stars = rows
    .filter((row) => DIMENSIONS.filter((d) => row.scores[d.id] !== null).length >= 3)
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 10);
  return (
    <section className={cn(panel, 'p-5', className)}>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Star className="size-5 text-amber-400" aria-hidden />
        All-rounders
      </h2>
      <p className="text-sm text-slate-500">Highest overall, with data on three fronts or more.</p>
      <ol className="mt-2 divide-y divide-slate-100">
        {stars.map((row, index) => (
          <StudentLine key={row.student.id} row={row} rank={index + 1} />
        ))}
      </ol>
      {stars.length === 0 && <p className="mt-4 text-sm text-slate-500">Not enough data yet.</p>}
    </section>
  );
}
