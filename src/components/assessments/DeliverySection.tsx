import { useState } from 'react';
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  Hourglass,
  Users,
} from 'lucide-react';

import { AnimatedRing } from '@/components/common/AnimatedRing';
import { lmsDate, type CampusDelivery } from '@/lib/assessments';
import { cohortLabel } from '@/lib/cohorts';
import { cn } from '@/lib/utils';

const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';

const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
/** Delivered against allocated: green from 75%, amber from 40%. */
const paceColor = (pct: number) => (pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444');

function Bar({ value, pending = 0, color }: { value: number; pending?: number; color: string }) {
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className="bar-fill h-full"
        style={{ width: `${Math.min(100, value)}%`, background: color }}
      />
      {pending > 0 && (
        <div
          className="h-full opacity-40"
          style={{ width: `${Math.min(100 - Math.min(100, value), pending)}%`, background: color }}
        />
      )}
    </div>
  );
}

type Trainer = CampusDelivery['trainers'][number];

/**
 * How a trainer's tracker hours compare with the LMS: in step within 10% (or 5 h), otherwise
 * which side has more, or that one side has nothing.
 */
function trainerGap(trainer: Trainer) {
  const logged = trainer.hours + trainer.pending_hours;
  if (!trainer.in_tracker) return { tone: 'warn', label: 'Not in tracker' } as const;
  if (trainer.lms_hours === null) return { tone: 'warn', label: 'Not in LMS' } as const;
  const gap = trainer.lms_hours - logged;
  if (Math.abs(gap) <= Math.max(5, 0.1 * Math.max(logged, trainer.lms_hours))) {
    return { tone: 'ok', label: 'In step' } as const;
  }
  return {
    tone: 'warn',
    label: gap > 0 ? `LMS +${gap} h` : `Tracker +${-gap} h`,
  } as const;
}

function TrainerRow({ trainer, peak }: { trainer: Trainer; peak: number }) {
  const gap = trainerGap(trainer);
  const logged = trainer.hours + trainer.pending_hours;
  return (
    <li className="py-2.5 text-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-medium">{trainer.name}</span>
          <span className="text-xs text-slate-500">
            {trainer.in_tracker
              ? `${trainer.classes} classes · last ${lmsDate(trainer.last_class)}`
              : `${trainer.lms_classes} LMS classes`}
            {trainer.attendance !== null && ` · ${trainer.attendance}% attendance`}
            {trainer.lms_name && ` · LMS: ${trainer.lms_name}`}
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            gap.tone === 'ok'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
          )}
        >
          {gap.label}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-[3.25rem_1fr_8.75rem] items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
        <span>Tracker</span>
        <span className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
          <span
            className="bar-fill bg-brand-500 h-full"
            style={{ width: `${(trainer.hours / peak) * 100}%` }}
          />
          <span
            className="bg-brand-500 h-full opacity-40"
            style={{ width: `${(trainer.pending_hours / peak) * 100}%` }}
          />
        </span>
        <span className="text-right tabular-nums">
          <b className="text-slate-800">{logged} h</b>
          {trainer.pending_hours > 0 && ` (${trainer.pending_hours} awaiting)`}
        </span>
        <span>LMS</span>
        <span className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
          <span
            className="bar-fill h-full bg-violet-500"
            style={{ width: `${((trainer.lms_hours ?? 0) / peak) * 100}%` }}
          />
        </span>
        <span className="text-right tabular-nums">
          <b className="text-slate-800">{trainer.lms_hours ?? 0} h</b>
        </span>
      </div>
    </li>
  );
}

/**
 * PRIME coding domain delivery for a campus: verified hours taught against the hours
 * allocated, by batch and section, by trainer, week by week, and topic by topic through the
 * syllabus. Data from the delivery tracker, copied nightly.
 */
export function DeliverySection({ data }: { data: CampusDelivery | null }) {
  const [allTopics, setAllTopics] = useState(false);
  if (!data) {
    return (
      <section className={cn(panel, 'border-dashed p-5 lg:col-span-3')}>
        <h2 className="text-lg font-bold">Syllabus vs Delivery</h2>
        <p className="mt-1 text-sm text-slate-500">
          No PRIME coding domain classes have been recorded for this selection yet.
        </p>
      </section>
    );
  }

  const done = share(data.delivered, data.allocated);
  const pending = share(data.pending, data.allocated);
  const curricula = [...new Set(data.topics.map((topic) => topic.curriculum))];
  const covered = data.topics.filter((topic) => topic.hours > 0).length;

  return (
    <section className={cn(panel, 'overflow-hidden lg:col-span-3')}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-0">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <BookOpenCheck className="text-brand-600 dark:text-brand-300 size-5" aria-hidden />
            Syllabus vs Delivery
          </h2>
          <p className="text-sm text-slate-500">
            PRIME coding domain hours taught against the hours allocated. Only verified classes
            count as delivered.
            {data.syncedAt && ` Updated ${lmsDate(data.syncedAt, true)}.`}
          </p>
        </div>
      </div>

      {/* Headline: the ring and four facts. */}
      <div className="grid gap-4 p-5 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
          <AnimatedRing value={done} size={96} stroke={9} color={(shown) => paceColor(shown)} />
          <div>
            <p className="text-2xl font-extrabold tabular-nums">
              {data.delivered.toLocaleString('en-IN')}
              <span className="text-base font-semibold text-slate-400">
                {' '}
                / {data.allocated.toLocaleString('en-IN')} h
              </span>
            </p>
            <p className="text-xs text-slate-500">delivered of allocated</p>
            {data.pending > 0 && (
              <p className="mt-1 text-xs font-semibold text-amber-600">
                +{data.pending} h awaiting verification
              </p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: CheckCircle2, label: 'Classes', value: data.classes.toLocaleString('en-IN') },
            { icon: Users, label: 'Trainers', value: String(data.trainer_count) },
            {
              icon: GraduationCap,
              label: 'Class attendance',
              value: data.attendance === null ? '—' : `${data.attendance}%`,
            },
            { icon: CalendarDays, label: 'Last class', value: lmsDate(data.last_class) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-slate-200 p-3">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon className="size-3.5" aria-hidden />
                {label}
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="px-5">
        <Bar value={done} pending={pending} color={paceColor(done)} />
        <div className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-slate-500">
          <span>{done}% delivered</span>
          {pending > 0 && <span>{pending}% awaiting verification</span>}
          {data.rejected > 0 && <span>{data.rejected} classes rejected</span>}
          {data.invalid > 0 && <span>{data.invalid} left out (impossible duration)</span>}
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        {/* By batch and section */}
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <Hourglass className="size-4 text-slate-400" aria-hidden />
            By batch and section
          </h3>
          <ul className="mt-2 space-y-2.5">
            {data.sections.map((row) => {
              const pct = share(row.delivered, row.allocated);
              return (
                <li key={`${row.program}-${row.batch_year}-${row.section}`}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {cohortLabel(row.program, row.batch_year)}
                      {row.section && (
                        <span className="text-slate-500"> · Section {row.section}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                      <b className="text-slate-800">{row.delivered}</b> / {row.allocated} h
                      {row.allocated > 0 && (
                        <b className="ml-1.5" style={{ color: paceColor(pct) }}>
                          {pct}%
                        </b>
                      )}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Bar
                      value={pct}
                      pending={share(row.pending, row.allocated)}
                      color={paceColor(pct)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Trainers and weeks */}
        <div className="space-y-5">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-bold">
              <Users className="size-4 text-slate-400" aria-hidden />
              By trainer: tracker vs LMS
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Hours logged in the tracker (verified and awaiting) beside PRIME coding classes in the
              LMS time table over the same dates.
            </p>
            <ul className="mt-2 divide-y divide-slate-100">
              {data.trainers.map((trainer) => (
                <TrainerRow
                  key={trainer.name}
                  trainer={trainer}
                  peak={Math.max(
                    1,
                    ...data.trainers.map((row) =>
                      Math.max(row.hours + row.pending_hours, row.lms_hours ?? 0)
                    )
                  )}
                />
              ))}
            </ul>
          </div>
          {data.weeks.length > 1 && (
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-bold">
                <Clock className="size-4 text-slate-400" aria-hidden />
                Hours taught each week
              </h3>
              <div className="mt-2 flex items-end gap-1" style={{ height: 72 }}>
                {data.weeks.slice(-12).map((week, index, all) => {
                  const peak = Math.max(1, ...all.map((item) => item.hours));
                  return (
                    <div
                      key={week.week}
                      className="group/bar flex h-full flex-1 flex-col justify-end"
                      title={`Week of ${lmsDate(week.week)}: ${week.hours} h`}
                    >
                      <div
                        className="bar-grow bg-brand-500 rounded-t-md"
                        style={{
                          height: `${Math.max(4, (week.hours / peak) * 100)}%`,
                          animationDelay: `${index * 60}ms`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>{lmsDate(data.weeks.slice(-12)[0].week)}</span>

                <span>{lmsDate(data.weeks.at(-1)!.week)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The syllabus, topic by topic */}
      <div className="border-t border-slate-200 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold">Syllabus coverage</h3>
          <span className="text-xs text-slate-500">
            {covered} of {data.topics.length} topics taught
          </span>
        </div>
        {curricula.map((curriculum) => {
          const topics = data.topics.filter((topic) => topic.curriculum === curriculum);
          const shown = allTopics ? topics : topics.slice(0, 8);
          const peak = Math.max(1, ...topics.map((topic) => topic.hours));
          return (
            <div key={curriculum} className="mt-3">
              {curricula.length > 1 && (
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {curriculum}
                </p>
              )}
              <ol className="grid gap-1.5 sm:grid-cols-2">
                {shown.map((topic) => (
                  <li
                    key={topic.topic}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        topic.hours > 0 ? 'bg-[#10b981] text-white' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {topic.hours > 0 ? '✓' : topic.topic_order}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={topic.topic}>
                        {topic.topic}
                      </span>
                      <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="bar-fill bg-brand-500 block h-full"
                          style={{ width: `${(topic.hours / peak) * 100}%` }}
                        />
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                      {topic.hours > 0 ? `${topic.hours} h` : 'Not yet'}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
        {data.topics.length > 8 && (
          <button
            type="button"
            onClick={() => setAllTopics(!allTopics)}
            className="text-brand-700 dark:text-brand-300 mt-3 text-sm font-semibold hover:underline"
          >
            {allTopics ? 'Show fewer' : 'Show every topic'}
          </button>
        )}
      </div>
    </section>
  );
}
