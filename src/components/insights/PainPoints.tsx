import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertOctagon,
  AlertTriangle,
  Award,
  CalendarCheck,
  ClipboardCheck,
  Code2,
  Info,
  NotebookPen,
  Sparkles,
  Users,
} from 'lucide-react';

import { DIMENSIONS, type DimensionId, type PainPoint } from '@/lib/insights';
import { cn } from '@/lib/utils';

const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';

/** The icon for each front, shared by the 360° page and the campus page. */
export const ICONS: Record<DimensionId, LucideIcon> = {
  coding: Code2,
  attendance: CalendarCheck,
  tests: ClipboardCheck,
  amcat: Award,
  exams: NotebookPen,
};

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

/**
 * What needs attention, most pressing first. `columns` lays them out two across (for a wide
 * panel); `action` adds a link in the header, e.g. to the full 360° view.
 */
export function PainPoints({
  points,
  className,
  limit = 6,
  columns = 1,
  action,
}: {
  points: PainPoint[];
  className?: string;
  limit?: number;
  columns?: 1 | 2;
  action?: ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? points : points.slice(0, limit);
  return (
    <section className={cn(panel, 'p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <AlertTriangle className="size-5 text-amber-500" aria-hidden />
          Pain points
        </h2>
        {action ?? <span className="text-xs text-slate-500">Most pressing first</span>}
      </div>
      {points.length === 0 ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-emerald-700">
          <Sparkles className="size-4" aria-hidden />
          Nothing stands out. Every front looks healthy here.
        </p>
      ) : (
        <ol
          className={cn(
            'rise-stagger mt-4 gap-2.5',
            columns === 2 ? 'grid md:grid-cols-2' : 'flex flex-col'
          )}
        >
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
      {points.length > limit && (
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
