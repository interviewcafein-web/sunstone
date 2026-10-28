// PRIME domain assessments and AMCAT results (api/assessments.ts), for staff pages.

import { useQuery } from '@tanstack/react-query';

export type TestCategory = 'assignment' | 'test' | 'mcq' | 'amcat_mock';
export type TestStatus = 'completed' | 'live' | 'scheduled' | 'unscheduled';

export const STATUS_LABELS: Record<TestStatus, string> = {
  completed: 'Completed',
  live: 'Live',
  scheduled: 'Scheduled',
  unscheduled: 'Not scheduled',
};

export const STATUS_STYLES: Record<TestStatus, string> = {
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  live: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  scheduled: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  unscheduled: 'bg-slate-100 text-slate-600',
};

export const CATEGORY_LABELS: Record<TestCategory, string> = {
  assignment: 'Assignment',
  test: 'Test',
  mcq: 'MCQ',
  amcat_mock: 'AMCAT mock',
};

export const CATEGORY_STYLES: Record<TestCategory, string> = {
  assignment: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  test: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  mcq: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
  amcat_mock: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
};

/** Score colour: green from 75%, amber from 50%, red below. */
export const scoreTone = (pct: number | null | undefined) =>
  pct == null
    ? 'text-slate-400'
    : pct >= 75
      ? 'text-emerald-600 dark:text-emerald-400'
      : pct >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

export const scoreFill = (pct: number | null | undefined) =>
  pct == null ? '#cbd5e1' : pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

/** "2026-10-27 19:14:00" (LMS time, India) → "27 Oct 2026". */
export function lmsDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—';
  const date = new Date(value.replace(' ', 'T').slice(0, 19));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

export const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

async function get<T>(params: Record<string, string | number | undefined>): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      value === undefined || value === '' ? [] : [[key, String(value)]]
    )
  );
  const response = await fetch(`/api/assessments?${query}`);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? 'Assessments could not be loaded.');
  return body as T;
}

const options = { staleTime: 5 * 60_000, retry: false } as const;

// --- Shapes -----------------------------------------------------------------------------

export interface CampusOverview {
  id: number;
  name: string;
  students: number;
  in_prime: number;
  tests: number;
  submissions: number;
  expected: number;
  avg_pct: number | null;
  scheduled: number;
  last_test_at: string | null;
}

/** A test as one campus sees it (its section copies merged). */
export interface CampusTest {
  ids: number[];
  name: string;
  category: TestCategory;
  status: TestStatus;
  subject: string;
  module: string | null;
  lecture: string | null;
  max_marks: string | null;
  minutes: number | null;
  released_at: string | null;
  /** Later release to more sections, if any. */
  last_release_at: string | null;
  due_at: string | null;
  eligible: number;
  submitted: number;
  avg_pct: number | null;
  top_pct: number | null;
}

export interface SubjectTest extends CampusTest {
  leaders: { name: string; username: string; pct: number | null }[];
}

export interface SyllabusModule {
  name: string;
  /** Tests on the module itself. */
  tests: CampusTest[];
  /** Sub-folders (lectures) that hold tests. */
  folders: { title: string; tests: CampusTest[] }[];
  total: number;
  released: number;
  started: boolean;
}

export interface CampusStudentRow {
  name: string;
  username: string;
  admission_year: number | null;
  program: string;
  released: number;
  submitted: number;
  avg_pct: number | null;
  last_submitted_at: string | null;
  amcat: number;
}

export interface CampusDetail {
  summary: {
    students: number;
    in_prime: number;
    tests: number;
    scheduled: number;
    unscheduled: number;
    submissions: number;
    expected: number;
    avg_pct: number | null;
    modules: number;
    modules_started: number;
  };
  subjectTests: SubjectTest[];
  subjects: { key: string; name: string; modules: SyllabusModule[] }[];
  timeline: { week: string; tests: number; avg_pct: number | null }[];
  students: CampusStudentRow[];
  batches: number[];
  now: string;
  syncedAt: string | null;
}

export interface TestStudent {
  name: string;
  username: string;
  admission_year: number | null;
  program: string;
  marks: string | null;
  max_marks: string | null;
  submitted: boolean;
  attempts: number | null;
  submitted_at: string | null;
  pct: number | null;
}

export interface TestDetail {
  test: {
    name: string;
    category: TestCategory;
    max_marks: string | null;
    minutes: number | null;
    copies: number;
  };
  students: TestStudent[];
}

export interface StudentTest {
  id: number;
  name: string;
  category: TestCategory;
  status: TestStatus;
  max_marks: string | null;
  released_at: string | null;
  due_at: string | null;
  subject: string | null;
  module: string | null;
  lecture: string | null;
  /** Position among classmates who submitted, and how many did. */
  rank: number | null;
  takers: number;
  marks: string | null;
  submitted: boolean;
  attempts: number | null;
  submitted_at: string | null;
  pct: number | null;
  class_avg_pct: number | null;
}

export interface AmcatSitting {
  id: number;
  test_name: string;
  taken_at: string | null;
  status: string | null;
  sections: { name: string; score: number | null; total: number | null }[];
}

export interface StudentAssessmentsData {
  tests: StudentTest[];
  amcat: AmcatSitting[];
  now: string;
  syncedAt: string | null;
}

// --- Hooks --------------------------------------------------------------------------------

export const useCampusOverview = () =>
  useQuery({
    queryKey: ['assessments', 'campuses'],
    queryFn: () =>
      get<{ campuses: CampusOverview[]; syncedAt: string | null }>({ view: 'campuses' }),
    ...options,
  });

export const useCampusDetail = (campus: number | undefined, batch: number | undefined) =>
  useQuery({
    queryKey: ['assessments', 'campus', campus, batch],
    queryFn: () => get<CampusDetail>({ view: 'campus', campus, batch }),
    enabled: campus !== undefined,
    ...options,
  });

export const useTestDetail = (
  campus: number | undefined,
  batch: number | undefined,
  test: string | undefined
) =>
  useQuery({
    queryKey: ['assessments', 'test', campus, batch, test],
    queryFn: () => get<TestDetail>({ view: 'test', campus, batch, test }),
    enabled: campus !== undefined && Boolean(test),
    ...options,
  });

export const useStudentAssessments = (username: string | undefined) =>
  useQuery({
    queryKey: ['assessments', 'student', username],
    queryFn: () => get<StudentAssessmentsData>({ view: 'student', s: username }),
    enabled: Boolean(username),
    ...options,
  });
