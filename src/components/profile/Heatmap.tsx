import { useMemo } from 'react';

import { cn } from '@/lib/utils';

const WEEKS = 53;
const LEVEL_CLASSES = [
  'bg-slate-200',
  'bg-brand-200',
  'bg-brand-400',
  'bg-brand-600',
  'bg-brand-800',
];

const level = (count: number) =>
  count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;

/** Totals for the same window the heatmap draws. */
export function summarizeCalendar(calendar: Record<string, number>) {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (WEEKS - 1) * 7 - end.getUTCDay());

  const days: { date: string; count: number }[] = [];
  let activeDays = 0;
  let total = 0;
  for (const day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    const count = calendar[date] || 0;
    if (count) {
      activeDays += 1;
      total += count;
    }
    days.push({ date, count });
  }
  return { days, activeDays, total };
}

export function Heatmap({ calendar }: { calendar: Record<string, number> }) {
  const { days, activeDays, total } = useMemo(() => summarizeCalendar(calendar), [calendar]);

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={`${total} submissions on ${activeDays} days in the last 12 months`}
          className="grid w-max grid-flow-col grid-rows-7 gap-0.5"
        >
          {days.map((day) => (
            <span
              key={day.date}
              title={`${day.date}: ${day.count}`}
              className={cn('size-2.5 rounded-xs', LEVEL_CLASSES[level(day.count)])}
            />
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {total.toLocaleString()} submissions on {activeDays} days
      </p>
    </div>
  );
}
