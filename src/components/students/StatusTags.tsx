import { Ban, CircleSlash } from 'lucide-react';

import type { StudentStatus } from '@/lib/students/types';
import { cn } from '@/lib/utils';

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** LMS standing as small tags: red "Debarred", grey "Inactive". Staff only (the API sends
 *  `status` to signed-in staff alone). The reason and dates are in the tooltip. */
export function StatusTags({
  status,
  className,
  size = 'sm',
}: {
  status?: StudentStatus;
  className?: string;
  size?: 'sm' | 'md';
}) {
  if (!status?.debarred && !status?.inactive) return null;
  const pill = cn(
    'inline-flex items-center gap-1 rounded-full font-semibold',
    size === 'sm' ? 'px-1.5 py-px text-[10px]' : 'px-2.5 py-0.5 text-xs'
  );
  const icon = size === 'sm' ? 'size-2.5' : 'size-3.5';

  const { debarred, inactive } = status;
  const debarredTitle =
    debarred &&
    [
      'Debarred',
      debarred.reason,
      debarred.until ? `until ${formatDate(debarred.until)}` : 'permanently',
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {debarred && (
        <span
          className={cn(pill, 'bg-red-600 text-white dark:bg-red-500')}
          title={debarredTitle || undefined}
        >
          <Ban className={icon} aria-hidden />
          Debarred
          {size === 'md' && debarredTitle && (
            <span className="font-normal opacity-90">
              · {debarredTitle.replace(/^Debarred · /, '')}
            </span>
          )}
        </span>
      )}
      {inactive && (
        <span
          className={cn(pill, 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200')}
          title={['Inactive in the LMS', inactive.reason].filter(Boolean).join(' · ')}
        >
          <CircleSlash className={icon} aria-hidden />
          Inactive
          {size === 'md' && inactive.reason && (
            <span className="font-normal opacity-80">· {inactive.reason}</span>
          )}
        </span>
      )}
    </span>
  );
}
