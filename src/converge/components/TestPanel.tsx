import { useEffect } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClipboardCheck, ShieldAlert, Target, Trophy, X } from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { InlineLoader } from '@/components/common/PageLoader';
import { lmsDate, scoreFill, scoreTone, useTestDetail } from '@/lib/assessments';
import { cohortLabel } from '@/lib/cohorts';
import { INTEGRITY_NOTE, integrityOf } from '@/lib/integrity';
import { chartColors, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

import { Link } from '../nav';
import { CategoryChip } from './chips';
import { HeroStat, Problem } from './ui';

const BANDS = [
  { label: '0–24%', from: 0, to: 25 },
  { label: '25–49%', from: 25, to: 50 },
  { label: '50–74%', from: 50, to: 75 },
  { label: '75–100%', from: 75, to: 101 },
];

/** A test's results at one campus (and batch), in a panel over the page. */
export function TestPanel({
  campusId,
  batch,
  test,
  onClose,
}: {
  campusId: number;
  batch?: string;
  /** The test's section copies' ids, "123,456". */
  test: string;
  onClose: () => void;
}) {
  const detail = useTestDetail(campusId, batch, test);
  const colors = chartColors(useTheme());

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  const students = detail.data?.students ?? [];
  const done = students.filter((student) => student.submitted);
  const pending = students.filter((student) => !student.submitted);
  const scores = done.map((student) => student.pct ?? 0);
  const total = scores.reduce((a, b) => a + b, 0);
  const average = scores.length ? Math.round(total / scores.length) : null;
  const spread = scores.length
    ? Math.sqrt(
        scores.reduce((sum, score) => sum + score * score, 0) / scores.length -
          (total / scores.length) ** 2
      )
    : null;
  const integrity = detail.data
    ? integrityOf({
        category: detail.data.test.category,
        submitted: scores.length,
        perfect: scores.filter((score) => score >= 100).length,
        avg: scores.length ? total / scores.length : null,
        spread,
      })
    : null;
  const bands = BANDS.map((band) => ({
    ...band,
    students: scores.filter((score) => score >= band.from && score < band.to).length,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Test results"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
      />
      <aside className="bg-surface animate-rise relative flex h-full w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
        <header className="from-brand-700 to-brand-900 relative bg-gradient-to-br px-5 py-5 text-white">
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d9a54a] to-transparent"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {detail.data && <CategoryChip category={detail.data.test.category} />}
              <h2 className="mt-1.5 text-xl font-bold">{detail.data?.test.name ?? 'Test'}</h2>
              {detail.data && (
                <p className="text-brand-100 text-sm">
                  {detail.data.test.max_marks && `${Number(detail.data.test.max_marks)} marks`}
                  {detail.data.test.minutes ? ` · ${detail.data.test.minutes} min` : ''}
                  {detail.data.test.copies > 1
                    ? ` · given to ${detail.data.test.copies} sections`
                    : ''}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {detail.data && (
            <dl className="mt-4 grid grid-cols-3 gap-2">
              <HeroStat
                icon={ClipboardCheck}
                label="Submitted"
                value={`${done.length}/${students.length}`}
              />
              <HeroStat
                icon={Target}
                label="Average"
                value={average === null ? '—' : `${average}%`}
              />
              <HeroStat
                icon={Trophy}
                label="Top Score"
                value={scores.length ? `${Math.max(...scores)}%` : '—'}
              />
            </dl>
          )}
        </header>
        {integrity && (
          <div
            role="note"
            className={cn(
              'flex items-start gap-3 border-b px-5 py-3 text-sm',
              integrity.level === 'high'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            )}
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">
                {integrity.level === 'high'
                  ? 'Possible copying: these scores are unusually high'
                  : 'Check these scores: higher and more uniform than usual'}
              </p>
              <ul className="mt-0.5 list-disc pl-4 text-xs">
                {integrity.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs opacity-80">{INTEGRITY_NOTE}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {detail.isPending ? (
            <InlineLoader label="Loading results" />
          ) : detail.isError ? (
            <Problem message={detail.error.message} />
          ) : (
            <div className="space-y-5">
              {scores.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Score Distribution</h3>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bands} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                        <CartesianGrid
                          stroke={colors.grid}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: colors.tick }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: colors.tick }}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: colors.cursor }}
                          contentStyle={{
                            background: colors.tooltip,
                            border: `1px solid ${colors.grid}`,
                            borderRadius: 12,
                            color: colors.text,
                            fontSize: 12,
                          }}
                          formatter={(value) => [value, 'Students']}
                        />
                        <Bar dataKey="students" radius={[6, 6, 0, 0]} animationDuration={900}>
                          {bands.map((band) => (
                            <Cell key={band.label} fill={scoreFill(band.from + 1)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Results · {done.length}</h3>
                <ol className="divide-y divide-dotted divide-slate-200 rounded-xl border border-slate-200">
                  {done.map((student, index) => (
                    <li key={student.username} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-6 text-right text-xs text-slate-400 tabular-nums">
                        {index + 1}
                      </span>
                      <Avatar name={student.name} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/s/$slug"
                          params={{ slug: student.username }}
                          className="text-brand-700 dark:text-brand-300 block truncate text-sm font-semibold hover:underline"
                        >
                          {student.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {cohortLabel(student.program, student.admission_year)} ·{' '}
                          {lmsDate(student.submitted_at, true)}
                          {student.attempts && student.attempts > 1
                            ? ` · ${student.attempts} attempts`
                            : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-bold tabular-nums', scoreTone(student.pct))}>
                          {student.pct}%
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {Number(student.marks ?? 0)}/{Number(student.max_marks ?? 0)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {pending.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Not Submitted · {pending.length}</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {pending.map((student) => (
                      <li key={student.username}>
                        <Link
                          to="/s/$slug"
                          params={{ slug: student.username }}
                          className="inline-block rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          {student.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
