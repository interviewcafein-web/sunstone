import { useState } from 'react';
import { CalendarDays, MessagesSquare, Mic, NotebookPen, UserX } from 'lucide-react';

import { Card, CardHeader } from '@/components/coding/ui';
import {
  EXAM_KIND_LABELS,
  examEventLabel,
  lmsDate,
  scoreFill,
  scoreTone,
  type CampusExams,
  type ExamEvent,
  type StudentExam,
} from '@/lib/assessments';
import { cn } from '@/lib/utils';

const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';

function Bar({ pct }: { pct: number | null }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct ?? 0}%`, backgroundColor: scoreFill(pct) }}
      />
    </div>
  );
}

// Newest term first; within a term: End-term, then Midterms, then other exams.
const eventOrder = (event: ExamEvent) => {
  const [type, term = ''] = event.event.split(':');
  const rank = type === 'endterm' ? 0 : type.startsWith('midterm') ? 1 : 2;
  return `${99999 - Number(term.replace('-', '') || 0)}-${rank}-${type}`;
};

/** Campus tab: internal exam events, each subject's results, and Mock PI / GD criteria. */
export function ExamsTab({ data }: { data: CampusExams }) {
  const subjectExams = data.events
    .filter((event) => event.kind === 'other')
    .sort((a, b) => eventOrder(a).localeCompare(eventOrder(b)));
  const [selected, setSelected] = useState<string | undefined>(subjectExams[0]?.event);
  const mocks = data.events.filter((event) => event.kind !== 'other');

  if (!data.events.length) {
    return (
      <p className={cn(panel, 'p-5 text-sm text-slate-500')}>
        No internal exam marks for this selection yet.
      </p>
    );
  }
  const subjects = data.subjects.filter(
    (subject) => subject.kind === 'other' && subject.event === selected
  );

  return (
    <div className="space-y-5">
      {subjectExams.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {subjectExams.map((event) => (
              <button
                key={event.event}
                type="button"
                onClick={() => setSelected(event.event)}
                aria-pressed={selected === event.event}
                className={cn(
                  panel,
                  'p-4 text-left transition',
                  selected === event.event ? 'ring-brand-500 ring-2' : 'hover:border-slate-300'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{examEventLabel(event.event)}</p>
                  <span className={cn('text-2xl font-bold tabular-nums', scoreTone(event.avg_pct))}>
                    {event.avg_pct === null ? '—' : `${event.avg_pct}%`}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {lmsDate(event.first_date)}
                  {event.last_date &&
                    event.last_date !== event.first_date &&
                    ` – ${lmsDate(event.last_date)}`}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <dd className="font-bold text-slate-800 tabular-nums">{event.students}</dd>
                    <dt className="text-slate-500">students</dt>
                  </div>
                  <div>
                    <dd className={cn('font-bold tabular-nums', scoreTone(event.pass_pct))}>
                      {event.pass_pct === null ? '—' : `${event.pass_pct}%`}
                    </dd>
                    <dt className="text-slate-500">passed</dt>
                  </div>
                  <div>
                    <dd
                      className={cn(
                        'font-bold tabular-nums',
                        event.absent ? 'text-red-600' : 'text-slate-800'
                      )}
                    >
                      {event.absent}
                    </dd>
                    <dt className="text-slate-500">absent</dt>
                  </div>
                </dl>
              </button>
            ))}
          </div>

          <section className={cn(panel, 'overflow-hidden')}>
            <div className="px-5 pt-5">
              <h2 className="text-lg font-bold">
                {selected ? examEventLabel(selected) : 'Exams'} · by subject
              </h2>
              <p className="text-sm text-slate-500">
                Average and pass rate (40% and above) per subject. Lowest averages first.
              </p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr className="border-y border-slate-200">
                    <th className="px-5 py-2 font-medium">Subject</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Average</th>
                    <th className="px-3 py-2 text-right font-medium">Passed</th>
                    <th className="px-5 py-2 text-right font-medium">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr
                      key={subject.subject}
                      className="border-b border-dotted border-slate-200 last:border-0"
                    >
                      <td className="px-5 py-2.5">
                        <p className="font-medium">{subject.subject}</p>
                        {subject.max_marks && (
                          <p className="text-xs text-slate-500">
                            Out of {Number(subject.max_marks)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-600">
                        {lmsDate(subject.exam_date)}
                      </td>
                      <td className="w-48 px-3 py-2.5">
                        {subject.avg_pct !== null ? (
                          <div className="flex items-center gap-2">
                            <Bar pct={subject.avg_pct} />
                            <span
                              className={cn(
                                'w-10 text-right font-bold tabular-nums',
                                scoreTone(subject.avg_pct)
                              )}
                            >
                              {subject.avg_pct}%
                            </span>
                          </div>
                        ) : subject.grades.length ? (
                          <span className="flex flex-wrap gap-1">
                            {subject.grades.map(({ grade, n }) => (
                              <span
                                key={grade}
                                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700"
                              >
                                {grade} · {n}
                              </span>
                            ))}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2.5 text-right font-semibold tabular-nums',
                          scoreTone(subject.pass_pct)
                        )}
                      >
                        {subject.pass_pct === null ? '—' : `${subject.pass_pct}%`}
                      </td>
                      <td className="px-5 py-2.5 text-right text-slate-600 tabular-nums">
                        {subject.students}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {mocks.length > 0 && (
        <section className={cn(panel, 'p-5')}>
          <h2 className="text-lg font-bold">Mock Interviews and Group Discussions</h2>
          <p className="text-sm text-slate-500">Scored by the panel on five criteria each.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(['mock_pi', 'mock_gd'] as const).map((kind) => {
              const rounds = mocks.filter((event) => event.kind === kind);
              if (!rounds.length) return null;
              const students = rounds.reduce((sum, event) => sum + event.students, 0);
              const scored = rounds.reduce((sum, event) => sum + event.scored, 0);
              const average = scored
                ? Math.round(
                    rounds.reduce((sum, event) => sum + (event.avg_pct ?? 0) * event.scored, 0) /
                      scored
                  )
                : null;
              const Icon = kind === 'mock_pi' ? Mic : MessagesSquare;
              return (
                <article key={kind} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-bold">
                        <Icon className="text-brand-700 dark:text-brand-300 size-4" aria-hidden />
                        {EXAM_KIND_LABELS[kind]}
                      </p>
                      <p className="text-xs text-slate-500">
                        {students} sittings ·{' '}
                        {rounds.map((event) => examEventLabel(event.event)).join(', ')}
                      </p>
                    </div>
                    <span className={cn('text-2xl font-bold tabular-nums', scoreTone(average))}>
                      {average === null ? '—' : `${average}%`}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {data.criteria
                      .filter((criterion) => criterion.kind === kind)
                      .map((criterion) => (
                        <li key={criterion.name}>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">{criterion.name}</span>
                            <span
                              className={cn(
                                'font-semibold tabular-nums',
                                scoreTone(criterion.avg_pct)
                              )}
                            >
                              {criterion.avg_pct}%
                            </span>
                          </div>
                          <div className="mt-1">
                            <Bar pct={criterion.avg_pct} />
                          </div>
                        </li>
                      ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/** Student profile: their internal exam marks by event, and Mock PI / GD scores. */
export function StudentExams({ exams }: { exams: StudentExam[] }) {
  if (!exams.length) return null;
  const subjectExams = exams.filter((exam) => exam.kind === 'other');
  const mocks = exams.filter((exam) => exam.kind !== 'other');
  const events = [...new Set(subjectExams.map((exam) => exam.event))];

  return (
    <Card className="overflow-hidden p-0">
      <div className="px-5 pt-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <NotebookPen className="text-brand-700 dark:text-brand-300 size-4" aria-hidden />
              Internal exams
            </span>
          }
          aside={
            <span className="text-xs text-slate-500">Midterms and end-term, from the LMS</span>
          }
        />
      </div>
      {events.map((event) => (
        <div key={event}>
          <p className="border-t border-slate-200 bg-slate-50 px-5 py-1.5 text-xs font-semibold text-slate-600">
            {examEventLabel(event)}
          </p>
          <table className="w-full text-sm">
            <tbody>
              {subjectExams
                .filter((exam) => exam.event === event)
                .map((exam) => (
                  <tr
                    key={exam.id}
                    className="border-b border-dotted border-slate-200 last:border-0"
                  >
                    <td className="px-5 py-2.5">
                      <p className="font-medium">{exam.subject}</p>
                      <p className="text-xs text-slate-500">{lmsDate(exam.exam_date)}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {exam.pct !== null ? (
                        <>
                          <span className={cn('font-bold tabular-nums', scoreTone(exam.pct))}>
                            {exam.pct}%
                          </span>
                          <span className="block text-xs text-slate-500 tabular-nums">
                            {Number(exam.marks)} / {Number(exam.max_marks)}
                          </span>
                        </>
                      ) : exam.grade_text && !/^ab(sent)?$/i.test(exam.grade_text) ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-700">
                          {exam.grade_text}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                          <UserX className="size-3" aria-hidden />
                          Absent
                        </span>
                      )}
                    </td>
                    <td className="w-24 px-5 py-2.5 text-right text-xs text-slate-500 tabular-nums">
                      Class {exam.class_avg_pct === null ? '—' : `${exam.class_avg_pct}%`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
      {mocks.length > 0 && (
        <div className="grid gap-3 border-t border-slate-200 p-5 md:grid-cols-2">
          {mocks.map((exam) => (
            <div key={exam.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{EXAM_KIND_LABELS[exam.kind] ?? exam.subject}</p>
                  <p className="text-xs text-slate-500">
                    {examEventLabel(exam.event)} · {lmsDate(exam.exam_date)}
                  </p>
                </div>
                <span className={cn('text-xl font-bold tabular-nums', scoreTone(exam.pct))}>
                  {exam.pct === null ? '—' : `${exam.pct}%`}
                </span>
              </div>
              {exam.criteria && (
                <ul className="mt-3 space-y-1.5">
                  {exam.criteria.map((criterion) => {
                    const pct =
                      criterion.marks !== null && criterion.max
                        ? Math.round((criterion.marks / criterion.max) * 100)
                        : null;
                    return (
                      <li key={criterion.name}>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">{criterion.name}</span>
                          <span className="font-semibold tabular-nums">
                            {criterion.marks ?? '—'}/{criterion.max ?? '—'}
                          </span>
                        </div>
                        <div className="mt-1">
                          <Bar pct={pct} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
