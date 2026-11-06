/** Attendance colour: green from 75%, amber from 60%, red below (as on Vertex's campus pages). */
export const attendanceTone = (pct: number | null | undefined) =>
  pct == null
    ? 'text-slate-400'
    : pct >= 75
      ? 'text-emerald-600 dark:text-emerald-400'
      : pct >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

export const attendanceFill = (pct: number | null | undefined) =>
  pct == null ? '#cbd5e1' : pct >= 75 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
