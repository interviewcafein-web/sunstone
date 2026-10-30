// Ask Vertex on the browser side (api/ask.ts): the AI status and the campuses for the quick
// questions, quick questions (no AI), typed questions (AI) and pain point suggestions (AI).

import { useQuery } from '@tanstack/react-query';

import { cohortLabel } from './cohorts';

export interface AskCampus {
  id: number;
  name: string;
  code: string | null;
  batches: { program: string; year: number; students: number }[];
}

export interface AskStatus {
  /** Whether the AI is set up on the server. */
  ai: boolean;
  questionsLeft: number;
  campuses: AskCampus[];
}

/** Why the AI could not answer: shown as a friendly note, quick questions still work. */
export type AskProblem = 'not_configured' | 'daily_limit' | 'busy' | 'user_limit' | 'error';

export class AskError extends Error {
  constructor(
    message: string,
    readonly kind: AskProblem
  ) {
    super(message);
  }
}

export const ASK_STATUS_KEY = ['ask-status'];

export const useAskStatus = (enabled: boolean) =>
  useQuery({
    queryKey: ASK_STATUS_KEY,
    queryFn: async () => {
      const response = await fetch('/api/ask');
      if (!response.ok) throw new Error('Ask Vertex is not available.');
      return (await response.json()) as AskStatus;
    },
    enabled,
    staleTime: 5 * 60_000,
  });

async function post<T>(body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AskError('No connection. Check your internet and try again.', 'error');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AskError(data.error ?? 'Something went wrong. Try again.', data.kind ?? 'error');
  }
  return data as T;
}

export interface AiAnswer {
  answer: string;
  questionsLeft?: number;
  /** A saved answer reused (no AI used). */
  saved?: boolean;
}

/** A typed question, with the conversation so far (AI turns only). */
export const askAi = (messages: { role: 'user' | 'assistant'; content: string }[]) =>
  post<AiAnswer>({ mode: 'chat', messages });

/** Suggested actions for the pain points shown, saved and reused while they stay the same. */
export const suggestActions = (
  scope: string,
  points: { severity: string; title: string; detail: string }[]
) => post<AiAnswer>({ mode: 'actions', scope, points });

// --- Quick questions: one lookup each, no AI, the answer written here --------------------

export interface QuickScope {
  campus?: AskCampus;
  /** "B.Tech:2025" or undefined for all batches. */
  batch?: string;
}

export interface QuickQuestion {
  id: string;
  label: string;
  /** Needs a campus chosen. */
  needsCampus?: boolean;
  tool: string;
  args: (scope: QuickScope) => Record<string, unknown>;
  format: (result: Record<string, any>) => string;
}

const scopeArgs = ({ campus, batch }: QuickScope) => {
  const [program, year] = batch ? batch.split(':') : [];
  return {
    ...(campus ? { campus: campus.code ?? campus.name } : {}),
    ...(program ? { program } : {}),
    ...(year ? { year: Number(year) } : {}),
  };
};

const cell = (value: unknown, suffix = '') =>
  value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`;
const table = (head: string[], rows: string[][]) =>
  [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
/** Table text cannot hold a pipe. */
const safe = (value: unknown) => String(value ?? '').replace(/\|/g, '/');

function studentsAnswer(result: Record<string, any>, what: string) {
  if (result.error) return result.error;
  if (!result.matches) return `No students ${what} in ${result.scope}.`;
  const students = result.students as Record<string, unknown>[];
  // One batch chosen: no need to repeat it on every row.
  const showBatch = new Set(students.map((s) => s.batch)).size > 1;
  return [
    `**${result.matches.toLocaleString('en-IN')} students** ${what} in ${result.scope}${
      result.matches > result.shown ? ` (lowest ${result.shown} shown)` : ''
    }.`,
    '',
    table(
      ['Student', ...(showBatch ? ['Batch'] : []), 'Attendance', 'Mock Tests', 'AMCAT', 'Solved'],
      students.map((s) => [
        `[${safe(s.name)}](${s.link})`,
        ...(showBatch ? [safe(s.batch)] : []),
        cell(s.attendance_pct, '%'),
        cell(s.mock_tests_pct, '%'),
        cell(s.amcat),
        cell(s.coding_solved),
      ])
    ),
  ].join('\n');
}

export const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    id: 'summary',
    label: 'Campus Summary',
    needsCampus: true,
    tool: 'campus_report',
    args: scopeArgs,
    format: (r) => {
      if (r.error) return r.error;
      const d = r.delivery;
      const lines = [
        `**${r.scope}** · ${r.students.toLocaleString('en-IN')} students`,
        '',
        `- **PRIME Mock Tests:** ${r.prime_mock_tests.released} out, average ${cell(r.prime_mock_tests.average_score_pct, '%')}, participation ${cell(r.prime_mock_tests.participation_pct, '%')}`,
        `- **Attendance:** ${cell(r.attendance.all_classes_pct, '%')} in all classes, ${cell(r.attendance.prime_classes_pct, '%')} in PRIME classes`,
        r.amcat_rounds.length
          ? `- **AMCAT:** latest round ${safe(r.amcat_rounds[0].name)}, average ${cell(r.amcat_rounds[0].average_score)} (${r.amcat_rounds[0].students} students)`
          : '- **AMCAT:** no rounds yet',
        r.internal_exams.length
          ? `- **Internal Exams:** ${r.internal_exams[0].event}, average ${cell(r.internal_exams[0].average_pct, '%')}, pass ${cell(r.internal_exams[0].pass_pct, '%')}`
          : '- **Internal Exams:** none yet',
        typeof d === 'object' && d
          ? `- **PRIME Coding Delivery:** ${d.verified_hours} of ${d.allocated_hours} h verified (${cell(d.verified_pct, '%')}), ${d.awaiting_verification_hours} h awaiting, ${d.still_to_go_hours} h to go`
          : '- **PRIME Coding Delivery:** nothing recorded in the tracker',
      ];
      if (typeof d === 'object' && d?.classes_not_logged_yet?.classes) {
        lines.push(`- **Classes Not Logged Yet:** ${d.classes_not_logged_yet.classes}`);
      }
      lines.push('', `[Open the Campus Page](${r.link})`);
      return lines.join('\n');
    },
  },
  {
    id: 'pain',
    label: 'Pain Points',
    tool: 'pain_points',
    args: scopeArgs,
    format: (r) => {
      if (r.error) return r.error;
      if (!r.pain_points.length)
        return `Nothing stands out in ${r.scope}. Every front looks healthy.`;
      return [
        `**${r.scope}** · ${r.students.toLocaleString('en-IN')} students`,
        '',
        ...r.pain_points.map(
          (p: Record<string, string>, i: number) =>
            `${i + 1}. **${p.title}** (${p.severity}). ${p.detail}`
        ),
        '',
        `[Open](${r.link})`,
      ].join('\n');
    },
  },
  {
    id: 'attendance',
    label: 'Attendance Below 60%',
    tool: 'find_students',
    args: (scope) => ({ ...scopeArgs(scope), attendance_below: 60, limit: 25 }),
    format: (r) => studentsAnswer(r, 'below 60% attendance'),
  },
  {
    id: 'mock',
    label: 'Mock Tests Below 50%',
    tool: 'find_students',
    args: (scope) => ({ ...scopeArgs(scope), mock_tests_below: 50, limit: 25 }),
    format: (r) => studentsAnswer(r, 'below 50% in PRIME Mock Tests'),
  },
  {
    id: 'risk',
    label: 'At Risk on 3+ Fronts',
    tool: 'find_students',
    args: (scope) => ({
      ...scopeArgs(scope),
      at_risk_fronts_at_least: 3,
      sort_by: 'overall',
      limit: 25,
    }),
    format: (r) => studentsAnswer(r, 'at risk on three fronts or more'),
  },
  {
    id: 'delivery',
    label: 'Delivery by Campus',
    tool: 'delivery_by_campus',
    args: () => ({}),
    format: (r) =>
      r.campuses.length
        ? [
            '**PRIME Coding Delivery**, furthest behind first',
            '',
            table(
              ['Campus', 'Verified', 'Allocated', 'Done', 'Awaiting'],
              r.campuses.map((c: Record<string, unknown>) => [
                `[${safe(c.campus)}](${c.link})`,
                `${c.verified_hours} h`,
                `${c.allocated_hours} h`,
                cell(c.verified_pct, '%'),
                `${c.awaiting_hours} h`,
              ])
            ),
          ].join('\n')
        : 'No PRIME coding delivery recorded for your campuses yet.',
  },
  {
    id: 'campuses',
    label: 'Compare Campuses',
    tool: 'list_campuses',
    args: () => ({}),
    format: (r) =>
      [
        '**Campuses**',
        '',
        table(
          ['Campus', 'Students', 'Mock Tests', 'Participation', 'Attendance'],
          r.campuses.map((c: Record<string, unknown>) => [
            `[${safe(c.name)}](${c.link})`,
            cell(c.students),
            cell(c.mock_tests_average_pct, '%'),
            cell(c.mock_tests_participation_pct, '%'),
            cell(c.attendance_pct, '%'),
          ])
        ),
      ].join('\n'),
  },
];

export async function runQuick(question: QuickQuestion, scope: QuickScope): Promise<string> {
  const { result } = await post<{ result: Record<string, unknown> }>({
    mode: 'tool',
    name: question.tool,
    args: question.args(scope),
  });
  return question.format(result);
}

/** "B.Tech:2025" → "B.Tech 2025–29", for the batch picker. */
export const batchOptionLabel = (program: string, year: number) => cohortLabel(program, year);
