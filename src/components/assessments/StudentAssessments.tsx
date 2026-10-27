import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Award, BookOpenCheck, ClipboardCheck, Loader2, Target, TrendingUp } from 'lucide-react';

import { Card, CardHeader } from '@/components/coding/ui';
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  lmsDate,
  percent,
  scoreFill,
  scoreTone,
  useStudentAssessments,
  type AmcatSitting,
} from '@/lib/assessments';
import { chartColors, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Award;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="shadow-card bg-surface rounded-2xl border border-slate-200 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** A student's Sunstone PRIME domain tests and AMCAT results. Staff only. */
export function StudentAssessments({ username }: { username: string }) {
  const query = useStudentAssessments(username);
  const colors = chartColors(useTheme());

  const trend = useMemo(
    () =>
      [...(query.data?.tests ?? [])]
        .filter((test) => test.submitted && test.pct !== null)
        .sort((a, b) => (a.released_at ?? '').localeCompare(b.released_at ?? ''))
        .map((test) => ({
          name: test.name,
          date: lmsDate(test.released_at),
          student: test.pct,
          class: test.class_avg_pct,
        })),
    [query.data]
  );

  if (query.isPending) {
    return (
      <Card>
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading assessments…
        </p>
      </Card>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <p className="text-sm text-red-700">{query.error.message}</p>
      </Card>
    );
  }

  const { tests, amcat, syncedAt } = query.data;
  const submitted = tests.filter((test) => test.submitted);
  const average = submitted.length
    ? Math.round(submitted.reduce((sum, test) => sum + (test.pct ?? 0), 0) / submitted.length)
    : null;
  const classAverages = submitted.filter((test) => test.class_avg_pct !== null);
  const classAverage = classAverages.length
    ? Math.round(
        classAverages.reduce((sum, test) => sum + (test.class_avg_pct ?? 0), 0) /
          classAverages.length
      )
    : null;
  const gap = average !== null && classAverage !== null ? average - classAverage : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={BookOpenCheck}
          label="PRIME tests released"
          value={String(tests.length)}
          hint="Prime Domain Coding"
        />
        <Kpi
          icon={ClipboardCheck}
          label="Submitted"
          value={`${submitted.length} of ${tests.length}`}
          hint={`${percent(submitted.length, tests.length)}% participation`}
          tone={scoreTone(percent(submitted.length, tests.length))}
        />
        <Kpi
          icon={Target}
          label="Average score"
          value={average === null ? '—' : `${average}%`}
          hint={
            gap === null
              ? undefined
              : `${gap >= 0 ? '+' : ''}${gap} pts vs class average (${classAverage}%)`
          }
          tone={scoreTone(average)}
        />
        <Kpi
          icon={Award}
          label="AMCAT sittings"
          value={String(amcat.length)}
          hint={amcat[0] ? `Latest ${lmsDate(amcat[0].taken_at)}` : 'None yet'}
        />
      </div>

      {trend.length > 1 && (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <TrendingUp className="text-brand-700 dark:text-brand-300 size-4" aria-hidden />
                Score trend
              </span>
            }
            aside={<span className="text-xs text-slate-500">Student vs class average, %</span>}
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.tick }} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: colors.tick }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: colors.tooltip,
                    border: `1px solid ${colors.grid}`,
                    borderRadius: 12,
                    color: colors.text,
                    fontSize: 12,
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
                  formatter={(value, key) => [
                    `${value}%`,
                    key === 'student' ? 'Student' : 'Class avg',
                  ]}
                />
                <Legend
                  formatter={(key) => (key === 'student' ? 'Student' : 'Class average')}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="class"
                  isAnimationActive={false}
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="student"
                  isAnimationActive={false}
                  stroke="#1a3e70"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="px-5 pt-4">
          <CardHeader
            title="Sunstone PRIME domain tests"
            aside={
              syncedAt && (
                <span className="text-xs text-slate-500">
                  From the LMS · {lmsDate(syncedAt, true)}
                </span>
              )
            }
          />
        </div>
        {tests.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-y border-slate-200">
                  <th className="px-5 py-2 font-medium">Test</th>
                  <th className="px-3 py-2 font-medium">Released</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-5 py-2 text-right font-medium">Class avg</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <tr
                    key={test.id}
                    className="border-b border-dotted border-slate-200 last:border-0"
                  >
                    <td className="px-5 py-2.5">
                      <p className="font-medium">{test.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-px text-[10px] font-semibold',
                            CATEGORY_STYLES[test.category]
                          )}
                        >
                          {CATEGORY_LABELS[test.category]}
                        </span>
                        {test.module}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                      {lmsDate(test.released_at)}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {test.submitted ? (
                        <>
                          <span className={cn('font-bold tabular-nums', scoreTone(test.pct))}>
                            {test.pct ?? '—'}%
                          </span>
                          <span className="block text-xs text-slate-500 tabular-nums">
                            {Number(test.marks ?? 0)} / {Number(test.max_marks ?? 0)}
                          </span>
                        </>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                          Not submitted
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-600 tabular-nums">
                      {test.class_avg_pct === null ? '—' : `${test.class_avg_pct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm text-slate-500">
            No PRIME domain tests have been released to this student's sections yet.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="AMCAT"
          aside={<span className="text-xs text-slate-500">Scores out of 100</span>}
        />
        {amcat.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {amcat.map((sitting) => (
              <AmcatCard key={sitting.id} sitting={sitting} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No AMCAT sittings yet.</p>
        )}
      </Card>
    </div>
  );
}

function AmcatCard({ sitting }: { sitting: AmcatSitting }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold" title={sitting.test_name}>
            {sitting.test_name}
          </p>
          <p className="text-xs text-slate-500">{lmsDate(sitting.taken_at)}</p>
        </div>
        {sitting.status && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {sitting.status}
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {sitting.sections.map((section) => {
          const pct = section.score === null ? null : percent(section.score, section.total ?? 100);
          return (
            <li key={section.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{section.name}</span>
                <span className={cn('font-semibold tabular-nums', scoreTone(pct))}>
                  {section.score === null ? 'Not taken' : section.score}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct ?? 0}%`, backgroundColor: scoreFill(pct) }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
