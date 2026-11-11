// A student's job offers and internships from the LMS (api/assessments.ts, view=student), on
// the student page of both Vertex and Converge. Campus staff see the offer but not the pay.

import { BriefcaseBusiness, CalendarDays, GraduationCap } from 'lucide-react';

import { formatPay, type StudentPlacement } from '@/lib/placements';
import { cn } from '@/lib/utils';

const date = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

function joiningTone(label: string | null, withdrawn: boolean) {
  if (withdrawn) return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  if (!label) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  if (/^Joined, working/.test(label))
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (/awaited/i.test(label))
    return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
}

export function PlacementCard({ placements }: { placements: StudentPlacement[] | undefined }) {
  if (!placements?.length) return null;
  const jobs = placements.filter((offer) => offer.full_time).length;
  const internships = placements.length - jobs;
  return (
    <section className="shadow-card bg-surface rounded-2xl border border-slate-200 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <BriefcaseBusiness className="text-brand-700 dark:text-brand-300 size-4.5" aria-hidden />
        Placements
        <span className="text-sm font-normal text-slate-500">
          {[
            jobs && `${jobs} job offer${jobs === 1 ? '' : 's'}`,
            internships && `${internships} internship${internships === 1 ? '' : 's'}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {placements.map((offer, index) => {
          const pay = offer.full_time ? offer.total_lpa : offer.stipend;
          return (
            <li
              key={`${offer.company}-${index}`}
              className={cn(
                'rounded-xl border p-3.5',
                offer.withdrawn ? 'border-dashed border-slate-300 opacity-80' : 'border-slate-200'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{offer.company ?? 'Company not given'}</p>
                  <p className="truncate text-sm text-slate-500">
                    {[offer.designation, offer.category].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {pay != null && (
                  <p className="text-brand-700 dark:text-brand-300 shrink-0 text-lg font-bold tabular-nums">
                    {formatPay(pay, offer.full_time)}
                  </p>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium">
                  {offer.full_time ? (
                    <BriefcaseBusiness className="size-3" aria-hidden />
                  ) : (
                    <GraduationCap className="size-3" aria-hidden />
                  )}
                  {offer.full_time
                    ? 'Full-time'
                    : `Internship${offer.months ? `, ${offer.months} months` : ''}`}
                </span>
                {offer.selected_on && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <CalendarDays className="size-3" aria-hidden />
                    Selected {date(offer.selected_on)}
                  </span>
                )}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-medium',
                    joiningTone(offer.joining, offer.withdrawn)
                  )}
                >
                  {offer.joining ?? 'Joining not updated'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
