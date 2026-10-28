import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardHeader, formatDate, formatNumber } from '@/components/coding/ui';
import { activityWindows, streaksOf } from '@/lib/coding-profiles/activity';
import type { ContestPoint, CountItem, DifficultyRow, Kpi } from '@/lib/coding-profiles/types';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { chartColors, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** Chart colours for the current site theme (SVG attributes cannot use CSS variables). */
function useChart() {
  const colors = chartColors(useTheme());
  return {
    ...colors,
    tickStyle: { fontSize: 11, fill: colors.tick },
    tooltipStyle: {
      borderRadius: 10,
      fontSize: 12,
      borderColor: colors.grid,
      backgroundColor: colors.tooltip,
      color: colors.text,
    },
  };
}

// ------------------------------------------------------------------ KPI tiles

export function KpiGrid({ kpis, color }: { kpis: Kpi[]; color: string }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="shadow-card relative flex flex-col-reverse overflow-hidden rounded-2xl border border-slate-200 bg-surface p-4"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-0.5"
            style={{ background: color }}
          />
          {kpi.hint && <p className="mt-0.5 truncate text-xs text-slate-500">{kpi.hint}</p>}
          <dd className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {kpi.value === null || kpi.value === undefined
              ? '—'
              : typeof kpi.value === 'number'
                ? formatNumber(kpi.value)
                : kpi.value}
          </dd>
          <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
            {kpi.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}

// ----------------------------------------------------------- recent activity

/**
 * Yesterday / last 7 days / last 30 days, each with a trend against the period before and a
 * small bar chart of its days: shows at a glance who has gone quiet or picked up pace.
 */
export function ActivityWindows({
  calendar,
  color,
}: {
  calendar: Record<string, number>;
  color: string;
}) {
  const ui = useChart();
  const windows = activityWindows(calendar);

  return (
    <div className="grid divide-slate-200 rounded-2xl border border-slate-200 bg-surface sm:grid-cols-3 sm:divide-x max-sm:divide-y">
      {windows.map((item) => {
        const change = item.value - item.previous;
        const max = Math.max(...item.series.map((day) => day.count), 1);
        const last = item.series.length - 1;
        return (
          <div key={item.label} className="flex items-end justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                {item.label}
              </p>
              <p
                className={cn(
                  'text-xl font-bold tabular-nums',
                  item.value ? 'text-slate-900' : 'text-slate-400'
                )}
              >
                {formatNumber(item.value)}
                <span className="ml-1 text-xs font-medium text-slate-500">submissions</span>
              </p>
              <p
                className={cn(
                  'mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium',
                  change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-600' : 'text-slate-400'
                )}
              >
                {change > 0 ? (
                  <TrendingUp className="size-3.5" aria-hidden />
                ) : change < 0 ? (
                  <TrendingDown className="size-3.5" aria-hidden />
                ) : (
                  <Minus className="size-3.5" aria-hidden />
                )}
                {change === 0
                  ? 'same as before'
                  : `${change > 0 ? '+' : ''}${formatNumber(change)} vs previous`}
              </p>
            </div>
            <svg
              viewBox={`0 0 ${item.series.length * 6} 36`}
              className="h-9 w-24 shrink-0"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Daily submissions, ${item.label.toLowerCase()}`}
            >
              {item.series.map((day, index) => {
                const height = day.count ? Math.max(3, (day.count / max) * 36) : 2;
                const current = item.label === 'Yesterday' ? index === last : true;
                return (
                  <rect
                    key={day.date}
                    x={index * 6 + 0.75}
                    y={36 - height}
                    width={4.5}
                    height={height}
                    rx={1}
                    fill={day.count ? color : ui.empty}
                    fillOpacity={day.count ? (current ? 1 : 0.35) : 1}
                  >
                    <title>{`${day.date}: ${day.count}`}</title>
                  </rect>
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------------- heatmap

const CELL = 11;
const GAP = 3;
const WEEKS = 53;

export function ActivityHeatmap({
  calendar,
  color,
  noun = 'submissions',
}: {
  calendar: Record<string, number>;
  color: string;
  noun?: string;
}) {
  const ui = useChart();
  const { days, total, months } = useMemo(() => {
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - (WEEKS - 1) * 7 - end.getUTCDay());

    const cells: { date: string; count: number; week: number; weekday: number }[] = [];
    const labels: { week: number; label: string }[] = [];
    let sum = 0;
    for (
      let day = new Date(start), index = 0;
      day <= end;
      day.setUTCDate(day.getUTCDate() + 1), index++
    ) {
      const date = day.toISOString().slice(0, 10);
      const count = calendar[date] || 0;
      sum += count;
      const week = Math.floor(index / 7);
      cells.push({ date, count, week, weekday: day.getUTCDay() });
      if (day.getUTCDate() <= 7 && day.getUTCDay() === 0) {
        labels.push({
          week,
          label: day.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }),
        });
      }
    }
    return { days: cells, total: sum, months: labels };
  }, [calendar]);

  const streaks = streaksOf(calendar);
  const level = (count: number) =>
    count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;
  const width = WEEKS * (CELL + GAP);
  const height = 7 * (CELL + GAP) + 16;

  return (
    <Card>
      <CardHeader
        title={
          <>
            <b className="tabular-nums">{formatNumber(total)}</b> {noun} in the last year
          </>
        }
        aside={
          <span className="flex gap-3">
            <span>
              Active days <b className="text-slate-900">{streaks.activeDays}</b>
            </span>
            <span>
              Best streak <b className="text-slate-900">{streaks.best}</b>
            </span>
            <span>
              Current <b className="text-slate-900">{streaks.current}</b>
            </span>
          </span>
        }
      />
      <div className="overflow-x-auto pb-1">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${total} ${noun} on ${streaks.activeDays} days in the last year`}
        >
          {months.map((month) => (
            <text
              key={`${month.week}-${month.label}`}
              x={month.week * (CELL + GAP)}
              y={10}
              fontSize={10}
              fill={ui.tick}
            >
              {month.label}
            </text>
          ))}
          {days.map((day) => {
            const value = level(day.count);
            return (
              <rect
                key={day.date}
                x={day.week * (CELL + GAP)}
                y={16 + day.weekday * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={2}
                fill={value ? color : ui.empty}
                fillOpacity={value ? 0.25 + value * 0.1875 : 1}
              >
                <title>{`${day.date}: ${day.count} ${noun}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------- bar list

export function BarList({
  items,
  color,
  unit,
}: {
  items: CountItem[];
  color: string;
  unit?: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="truncate text-slate-700" title={item.label}>
              {item.label}
            </span>
            <span className="text-slate-500 tabular-nums">
              {unit === '%'
                ? `${Math.round((item.count / total) * 100)}%`
                : formatNumber(item.count)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.count / max) * 100}%`, background: item.color ?? color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// -------------------------------------------------------------------- donut

export function Donut({
  title,
  rows,
  aside,
}: {
  title: string;
  rows: CountItem[];
  aside?: string;
}) {
  const ui = useChart();
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div>
      <CardHeader title={title} aside={aside} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative size-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={total ? rows : [{ label: 'None', count: 1 }]}
                dataKey="count"
                nameKey="label"
                innerRadius={46}
                outerRadius={66}
                paddingAngle={total ? 2 : 0}
                stroke="none"
                animationDuration={900}
              >
                {(total ? rows : [{ label: 'None', count: 1 }]).map((row) => (
                  <Cell key={row.label} fill={total ? row.color : ui.empty} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums">{formatNumber(total)}</span>
            <span className="text-[10px] tracking-wide text-slate-500 uppercase">solved</span>
          </div>
        </div>
        <ul className="min-w-40 flex-1 space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5 text-xs"
            >
              <span className="flex items-center gap-2 text-slate-700">
                <span className="size-2 rounded-full" style={{ background: row.color }} />
                {row.label}
              </span>
              <span className="font-semibold tabular-nums">
                {formatNumber(row.count)}
                {total > 0 && (
                  <span className="ml-1.5 font-normal text-slate-400">
                    {Math.round((row.count / total) * 100)}%
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ------------------------------------------------- attempted vs solved (LC)

export function DifficultyBreakdown({ rows }: { rows: DifficultyRow[] }) {
  const ui = useChart();
  const data = rows.map((row) => ({
    label: row.label,
    Attempted: row.attempted ?? row.solved,
    Solved: row.solved,
    color: row.color,
  }));

  return (
    <Card>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CardHeader title="Attempted vs solved" aside="distinct problems" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={ui.grid} vertical={false} />
                <XAxis dataKey="label" tick={ui.tickStyle} axisLine={false} tickLine={false} />
                <YAxis
                  tick={ui.tickStyle}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={ui.tooltipStyle} cursor={{ fill: ui.cursor }} />
                <Bar dataKey="Attempted" radius={[4, 4, 0, 0]} animationDuration={900}>
                  {data.map((row) => (
                    <Cell key={row.label} fill={row.color} fillOpacity={0.28} />
                  ))}
                </Bar>
                <Bar dataKey="Solved" radius={[4, 4, 0, 0]} animationDuration={900}>
                  {data.map((row) => (
                    <Cell key={row.label} fill={row.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="lg:col-span-2">
          <Donut
            title="Solved split"
            rows={rows.map((row) => ({ label: row.label, count: row.solved, color: row.color }))}
          />
        </div>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {rows.map((row) => {
          const unsolved = (row.attempted ?? row.solved) - row.solved;
          return (
            <li key={row.label} className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <p className="font-semibold" style={{ color: row.color }}>
                {row.label}
              </p>
              <p className="text-slate-700 tabular-nums">
                <b>{formatNumber(row.solved)}</b>
                {row.total ? ` / ${formatNumber(row.total)}` : ''} solved
                {row.acceptance !== undefined && ` · ${row.acceptance}% accepted`}
              </p>
              {unsolved > 0 && (
                <p className="text-amber-700">{formatNumber(unsolved)} attempted, not solved yet</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ------------------------------------------------------------- rating chart

export function RatingChart({ history, color }: { history: ContestPoint[]; color: string }) {
  const ui = useChart();
  const gradientId = `rating-${useId().replace(/:/g, '')}`;
  const sorted = [...history].sort((a, b) => a.time - b.time);
  const spansYears =
    sorted.length > 1 && sorted[sorted.length - 1].time - sorted[0].time > 365 * 86400;
  const tickFormat = (seconds: number) =>
    new Date(seconds * 1000).toLocaleDateString(
      'en-IN',
      spansYears ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' }
    );

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sorted} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={ui.grid} vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={tickFormat}
            tick={ui.tickStyle}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[
              (min: number) => Math.floor((min - 50) / 50) * 50,
              (max: number) => Math.ceil((max + 50) / 50) * 50,
            ]}
            tick={ui.tickStyle}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={ui.tooltipStyle}
            labelFormatter={(seconds) => formatDate(Number(seconds))}
            formatter={(value, _name, item) => [
              `${value}${item.payload.rank ? ` · rank ${formatNumber(item.payload.rank)}` : ''}`,
              item.payload.title,
            ]}
          />
          <Area
            type="monotone"
            dataKey="rating"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={sorted.length < 30 ? { r: 2.5, fill: color, strokeWidth: 0 } : false}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RatingCard({
  history,
  color,
  current,
}: {
  history: ContestPoint[];
  color: string;
  current: number | null;
}) {
  const best = Math.max(...history.map((point) => point.rating));
  const latest = [...history].sort((a, b) => b.time - a.time)[0];

  return (
    <Card>
      <CardHeader
        title="Contest rating"
        aside={
          <>
            {history.length} contests · best <b className="text-slate-900">{formatNumber(best)}</b>
          </>
        }
      />
      <RatingChart history={history} color={color} />
      {latest && (
        <p className="mt-2 truncate text-xs text-slate-500">
          Latest: {latest.title} →{' '}
          <b className="text-slate-900">{formatNumber(current ?? latest.rating)}</b>
        </p>
      )}
    </Card>
  );
}

// ------------------------------------------------ Codeforces rating histogram

/** Codeforces rank colours, by problem rating. */
export function cfColor(rating: number) {
  if (rating < 1200) return '#9CA3AF';
  if (rating < 1400) return '#22C55E';
  if (rating < 1600) return '#14B8A6';
  if (rating < 1900) return '#3B82F6';
  if (rating < 2100) return '#A855F7';
  if (rating < 2400) return '#F59E0B';
  return '#EF4444';
}

export function RatingHistogram({ items }: { items: CountItem[] }) {
  const ui = useChart();
  const solved = items.reduce((sum, item) => sum + item.count, 0);
  const hardest = items.length ? items[items.length - 1].label : '—';

  return (
    <Card>
      <CardHeader
        title="Solved by problem rating"
        aside={
          <>
            {formatNumber(solved)} rated problems · hardest{' '}
            <b className="text-slate-900">{hardest}</b>
          </>
        }
      />
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ui.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={ui.tickStyle}
              axisLine={false}
              tickLine={false}
              minTickGap={8}
            />
            <YAxis tick={ui.tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={ui.tooltipStyle}
              cursor={{ fill: ui.cursor }}
              formatter={(value) => [value, 'Solved']}
              labelFormatter={(label) => `Rating ${label}`}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={900}>
              {items.map((item) => (
                <Cell key={item.label} fill={cfColor(Number(item.label))} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
