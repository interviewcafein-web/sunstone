import { FileDown, Info, Loader2 } from 'lucide-react';

import type { StudentRow } from '@/components/students/StudentsTable';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import { ZONE_BASIS, ZONES, type ZoneId } from '@/lib/students/zones';
import { cn } from '@/lib/utils';

interface ZonePanelProps {
  rows: StudentRow[];
  active?: ZoneId;
  onZone: (zone: ZoneId | undefined) => void;
  report: {
    /** Why the report cannot be downloaded yet, if it cannot. */
    blocker?: string;
    state: 'idle' | 'busy' | 'failed';
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
  ).join(' → ');

  return (
    <section className="shadow-card bg-surface rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            Practice zones
            <span
              title={`Placed by problems solved on the first usable platform: ${basisNames}. GitHub is not used.`}
              className="text-slate-400"
            >
              <Info className="size-3.5" aria-hidden />
              <span className="sr-only">
                Placed by problems solved on the first usable platform: {basisNames}.
              </span>
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            By LeetCode solved, or the next platform if there is no LeetCode. Click a zone to list
            only those students.
          </p>
        </div>

        <div className="text-right">
          <button
            type="button"
            onClick={report.onDownload}
            disabled={Boolean(report.blocker) || report.state === 'busy'}
            className="bg-brand-700 hover:bg-brand-800 focus-visible:outline-brand-500 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {report.state === 'busy' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="size-4" aria-hidden />
            )}
            {report.state === 'busy' ? 'Preparing PDF…' : 'Download campus report'}
          </button>
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

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <ZoneButton
          selected={!active}
          onClick={() => onZone(undefined)}
          color="#274f87"
          label="All students"
          count={rows.length}
          rule={pending ? `${pending} still loading` : 'every zone'}
        />
        {ZONES.map((zone) => (
          <ZoneButton
            key={zone.id}
            selected={active === zone.id}
            onClick={() => onZone(active === zone.id ? undefined : zone.id)}
            color={zone.color}
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

function ZoneButton({
  selected,
  onClick,
  color,
  label,
  count,
  rule,
  share,
}: {
  selected: boolean;
  onClick: () => void;
  color: string;
  label: string;
  count: number;
  rule: string;
  share?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-xl border p-3 text-left transition hover:-translate-y-0.5',
        selected ? 'border-transparent ring-2' : 'border-slate-200 hover:border-slate-300'
      )}
      style={{
        backgroundColor: `${color}12`,
        ...(selected ? { ['--tw-ring-color' as string]: color } : {}),
      }}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="mt-1 block text-2xl font-bold tabular-nums">{count.toLocaleString()}</span>
      <span className="block text-[11px] text-slate-500">{rule}</span>
      {share !== undefined && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1"
          style={{
            background: `linear-gradient(to right, ${color} ${share * 100}%, transparent 0)`,
          }}
        />
      )}
    </button>
  );
}
