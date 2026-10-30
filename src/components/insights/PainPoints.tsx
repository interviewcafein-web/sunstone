import { useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  AlertOctagon,
  AlertTriangle,
  Award,
  CalendarCheck,
  ClipboardCheck,
  Code2,
  Info,
  Loader2,
  NotebookPen,
  Sparkles,
  Users,
} from 'lucide-react';

import { Markdown } from '@/components/ask/Markdown';
import { AskError, suggestActions } from '@/lib/ask';
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

const AI_NOTES: Record<string, string> = {
  daily_limit: "Today's free AI allowance is used up. Try again tomorrow.",
  user_limit: "You've used today's AI questions. Try again tomorrow.",
  busy: 'The AI is busy right now. Try again in a minute.',
  not_configured: 'The AI is not set up yet.',
};

/** AI suggestions for the pain points shown, kept while they stay the same. */
function SuggestedActions({ scope, points }: { scope: string; points: PainPoint[] }) {
  const ask = useMutation({
    mutationFn: () =>
      suggestActions(
        scope,
        points.slice(0, 6).map(({ severity, title, detail }) => ({ severity, title, detail }))
      ),
  });
  if (ask.isIdle) {
    return (
      <button
        type="button"
        onClick={() => ask.mutate()}
        className="text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold"
      >
        <Sparkles className="size-4 text-amber-500" aria-hidden />
        Suggest actions
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-white p-4 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-transparent">
      <p className="flex items-center gap-1.5 text-sm font-bold">
        <Sparkles className="size-4 text-amber-500" aria-hidden />
        Suggested actions
        <span className="ml-auto text-[11px] font-normal text-slate-500">
          AI suggestions · check before acting
        </span>
      </p>
      {ask.isPending && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Working out what to do…
        </p>
      )}
      {ask.isError && (
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">
          {(ask.error instanceof AskError && AI_NOTES[ask.error.kind]) || ask.error.message}{' '}
          <button
            type="button"
            onClick={() => ask.mutate()}
            className="font-semibold underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </p>
      )}
      {ask.data && <Markdown text={ask.data.answer} className="mt-3" />}
    </div>
  );
}

/**
 * What needs attention, most pressing first. `columns` lays them out two across (for a wide
 * panel); `action` adds a link in the header, e.g. to the full 360° view; `scope` (what these
 * pain points are for, e.g. "SAGE University · B.Tech 2025–29") offers AI suggested actions.
 */
export function PainPoints({
  points,
  className,
  limit = 6,
  columns = 1,
  action,
  scope,
}: {
  points: PainPoint[];
  className?: string;
  limit?: number;
  columns?: 1 | 2;
  action?: ReactNode;
  scope?: string;
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
      {scope && points.length > 0 && <SuggestedActions key={scope} scope={scope} points={points} />}
    </section>
  );
}
