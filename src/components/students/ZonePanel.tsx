import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  FileDown,
  Footprints,
  Info,
  Link2Off,
  Loader2,
  Rocket,
  TrendingUp,
  Users,
} from 'lucide-react';

import { CountUp } from '@/components/common/CountUp';

import type { StudentRow } from '@/components/students/StudentsTable';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import { PlatformLogo } from '@/components/profile/PlatformLogo';
import { ZONE_BASIS, ZONES, type ZoneId } from '@/lib/students/zones';

const ZONE_ICONS: Record<ZoneId, LucideIcon> = {
  green: Rocket,
  yellow: TrendingUp,
  orange: Footprints,
  red: AlertTriangle,
  none: Link2Off,
};
import { cn } from '@/lib/utils';

interface ZonePanelProps {
  rows: StudentRow[];
  active?: ZoneId;
  onZone: (zone: ZoneId | undefined) => void;
  report: {
    /** Why the report cannot be downloaded yet, if it cannot. */
    blocker?: string;
    /** Shown under the button without disabling it. */
    note?: string;
    state: 'idle' | 'busy' | 'failed';
    /** Button text, e.g. "Download campus report". */
    label: string;
    onDownload: () => void;
  };
}

/** Zone counts that double as a filter, and the campus report download. */
export function ZonePanel({ rows, active, onZone, report }: ZonePanelProps) {
  const counts = Object.fromEntries(
    ZONES.map((zone) => [zone.id, rows.filter((row) => row.zone?.zone === zone.id).length])
  ) as Record<ZoneId, number>;
  const pending = rows.filter((row) => !row.zone).length;
  const basisNames = ZONE_BASIS.map(
    (id) => PLATFORMS.find((platform) => platform.id === id)!.name
  ).join(', ');

  return (
    <section className="shadow-card bg-surface rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-bold">
            Practice zones
            <span
              title={`Placed by the best solved count on any one of: ${basisNames}. Platforms are not added together; HackerRank and GitHub are not used.`}
              className="text-slate-400"
            >
              <Info className="size-3.5" aria-hidden />
              <span className="sr-only">
                Placed by the best solved count on any one of: {basisNames}.
              </span>
            </span>
          </h2>
          <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-slate-500">
            By the best solved count on one platform:
            {ZONE_BASIS.map((id, i) => (
              <span key={id} className="inline-flex items-center gap-1 font-medium text-slate-600">
                <PlatformLogo platform={id} className="size-3" />
                {PLATFORMS.find((platform) => platform.id === id)!.name}
                {i < ZONE_BASIS.length - 1 ? ',' : '.'}
              </span>
            ))}
            Click a zone to list only those students.
          </p>
        </div>

        <div className="text-right">
          <button
            type="button"
            onClick={report.onDownload}
            disabled={Boolean(report.blocker) || report.state === 'busy'}
            className="from-brand-600 to-brand-800 focus-visible:outline-brand-500 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
          >
            {report.state === 'busy' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="size-4" aria-hidden />
            )}
            {report.state === 'busy' ? 'Preparing PDF…' : report.label}
          </button>
          {report.note && !report.blocker && report.state !== 'failed' && (
            <p className="mt-1 text-xs text-slate-500">{report.note}</p>
          )}
          {(report.blocker || report.state === 'failed') && (
            <p
              className={cn(
                'mt-1 text-xs',
                report.state === 'failed' ? 'text-red-600' : 'text-slate-500'
              )}
            >
              {report.state === 'failed'
                ? 'The report could not be created. Try again.'
                : report.blocker}
            </p>
          )}
        </div>
      </div>

      <DistributionBar counts={counts} active={active} onZone={onZone} />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <ZoneButton
          selected={!active}
          onClick={() => onZone(undefined)}
          color="#274f87"
          icon={Users}
          label="All students"
          count={rows.length}
          rule={pending ? `${pending.toLocaleString()} still loading` : 'every zone'}
          loading={pending > 0}
        />
        {ZONES.map((zone) => (
          <ZoneButton
            key={zone.id}
            selected={active === zone.id}
            onClick={() => onZone(active === zone.id ? undefined : zone.id)}
            color={zone.color}
            icon={ZONE_ICONS[zone.id]}
            label={zone.label}
            count={counts[zone.id]}
            rule={zone.rule}
            share={rows.length ? counts[zone.id] / rows.length : 0}
          />
        ))}
      </div>
    </section>
  );
}

/** Every zone's share of the students as one bar; a segment filters like its card. */
function DistributionBar({
  counts,
  active,
  onZone,
}: {
  counts: Record<ZoneId, number>;
  active?: ZoneId;
  onZone: (zone: ZoneId | undefined) => void;
}) {
  const total = ZONES.reduce((sum, zone) => sum + counts[zone.id], 0);
  if (!total) return null;
  return (
    <div className="mt-4">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100">
        {ZONES.map((zone) => {
          const share = counts[zone.id] / total;
          if (!share) return null;
          return (
            <button
              key={zone.id}
              type="button"
              title={`${zone.label}: ${counts[zone.id].toLocaleString()} (${Math.round(share * 100)}%)`}
              aria-label={`${zone.label}: ${Math.round(share * 100)}%`}
              onClick={() => onZone(active === zone.id ? undefined : zone.id)}
              className={cn(
                'h-full transition-[width,opacity] duration-700 ease-out first:rounded-l-full last:rounded-r-full hover:opacity-80',
                active && active !== zone.id && 'opacity-30'
              )}
              style={{ width: `${share * 100}%`, background: zone.color }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {ZONES.map((zone) =>
          counts[zone.id] ? (
            <span key={zone.id} className="inline-flex items-center gap-1 tabular-nums">
              <span className="size-2 rounded-full" style={{ background: zone.color }} />
              {zone.label.replace(' zone', '')} {Math.round((counts[zone.id] / total) * 100)}%
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

function ZoneButton({
  selected,
  onClick,
  color,
  icon: Icon,
  label,
  count,
  rule,
  share,
  loading = false,
}: {
  selected: boolean;
  onClick: () => void;
  color: string;
  icon: LucideIcon;
  label: string;
  count: number;
  rule: string;
  share?: number;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'group relative isolate overflow-hidden rounded-2xl border p-3.5 text-left transition duration-300 hover:-translate-y-1',
        selected ? 'border-transparent text-white shadow-lg' : 'border-slate-200 hover:shadow-md'
      )}
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              boxShadow: `0 14px 30px -14px ${color}`,
            }
          : { backgroundColor: `${color}0f` }
      }
    >
      {/* A soft disc of the zone colour in the corner, brighter on hover. */}
      <span
        aria-hidden
        className="absolute -top-6 -right-6 -z-10 size-20 rounded-full opacity-20 transition-transform duration-500 group-hover:scale-125"
        style={{ background: selected ? '#ffffff' : color }}
      />
      <span className="flex items-center justify-between gap-2">
        <span
          className="flex size-8 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
          style={
            selected
              ? { background: 'rgb(255 255 255 / 0.2)', color: '#ffffff' }
              : { background: `${color}1f`, color }
          }
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Icon className="size-4" aria-hidden />
          )}
        </span>
        {share !== undefined && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
            style={
              selected
                ? { background: 'rgb(255 255 255 / 0.2)', color: '#ffffff' }
                : { background: `${color}1a`, color }
            }
          >
            {Math.round(share * 100)}%
          </span>
        )}
      </span>
      <span
        className={cn('mt-2.5 block text-xs font-semibold', selected && 'text-white/90')}
        style={selected ? undefined : { color }}
      >
        {label}
      </span>
      <span className="block text-2xl font-extrabold tracking-tight tabular-nums">
        <CountUp value={count} />
      </span>
      <span className={cn('block text-[11px]', selected ? 'text-white/80' : 'text-slate-500')}>
        {rule}
      </span>
      {share !== undefined && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1 transition-all duration-700"
          style={{
            background: `linear-gradient(to right, ${selected ? '#ffffffaa' : color} ${share * 100}%, transparent 0)`,
          }}
        />
      )}
    </button>
  );
}
