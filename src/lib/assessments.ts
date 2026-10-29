// PRIME domain assessments and AMCAT results (api/assessments.ts), for staff pages.

import { useQuery } from '@tanstack/react-query';

import type { Integrity } from './integrity';

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
  // Mock tests run on Sunstone's own LMS; real AMCAT results come from the AMCAT platform.
  amcat_mock: 'Mock test (LMS)',
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
    Object.fromEntries(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)])
    )
  );
  const response = await fetch(`/api/assessments?${query}`);
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
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
  attendance_pct: number | null;
  last_test_at: string | null;
  /** The campus logo from the LMS (a full https URL), if it has one. */
  logo: string | null;
  /** Weekly attendance %, last ten weeks. */
  attendance_weeks: number[];
  /** Average test score % by week of release, last ten weeks. */
  test_weeks: number[];
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
  /** Submissions with full marks. */
  perfect: number;
  /** Set when the scores look unusually high and uniform for this kind of test. */
  integrity: Integrity | null;
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
  attendance_pct: number | null;
  prime_attendance_pct: number | null;
  sessions: number;
  amcat: number;
  amcat_avg: number | null;
  exam_avg: number | null;
  /** Marks on each Prime Mock Test that is out, by the test's ids joined ("12,34"). */
  mocks: Record<string, { pct: number | null; marks: number | null; submitted: boolean }>;
  /** Score on each AMCAT round, by round name. */
  amcat_rounds: Record<string, { score: number | null; taken_on: string | null }>;
}

export interface CampusAttendance {
  marks: number;
  pct: number | null;
  prime_pct: number | null;
  students: number;
  weeks: { week: string; marks: number; pct: number | null }[];
  subjects: {
    subject: string;
    students: number;
    marks: number;
    pct: number | null;
    prime: boolean;
  }[];
  faculty: {
    faculty_id: number;
    faculty: string;
    sessions: number;
    marks: number;
    pct: number | null;
    subjects: string;
    prime: boolean;
    last_class: string | null;
  }[];
  syncedAt: string | null;
}

export interface AmcatRound {
  test_name: string;
  students: number;
  first_at: string | null;
  last_at: string | null;
  avg_score: number | null;
  sections: { name: string; avg: number | null; takers: number }[] | null;
  top: { name: string; username: string; avg: number }[] | null;
}

/** "midterm_1:2026-2" → "Midterm 1 · Jul–Dec 2026", "endterm:2026-1" → "End-term · Jan–Jun 2026". */
export function examEventLabel(event: string, withTerm = true): string {
  const [type, term] = event.split(':');
  const midterm = type.match(/^midterm_(\d+)$/);
  const name = midterm ? `Midterm ${midterm[1]}` : type === 'endterm' ? 'End-term' : 'Other exams';
  const half = term?.match(/^(\d{4})-([12])$/);
  if (!withTerm || !half) return name;
  return `${name} · ${half[2] === '2' ? 'Jul–Dec' : 'Jan–Jun'} ${half[1]}`;
}

export const EXAM_KIND_LABELS: Record<string, string> = {
  other: 'Subject exams',
  mock_pi: 'Mock interview (PI)',
  mock_gd: 'Group discussion (GD)',
};

export interface ExamEvent {
  event: string;
  kind: string;
  students: number;
  subjects: number;
  marks: number;
  scored: number;
  avg_pct: number | null;
  pass_pct: number | null;
  absent: number;
  first_date: string | null;
  last_date: string | null;
}

export interface ExamSubject {
  event: string;
  kind: string;
  subject: string;
  students: number;
  avg_pct: number | null;
  pass_pct: number | null;
  max_marks: string | null;
  exam_date: string | null;
  grades: { grade: string; n: number }[];
}

export interface CampusExams {
  events: ExamEvent[];
  subjects: ExamSubject[];
  criteria: { kind: string; name: string; avg_pct: number | null; scores: number }[];
  syncedAt: string | null;
}

export interface StudentExam {
  id: number;
  event: string;
  kind: string;
  subject: string;
  title: string | null;
  exam_date: string | null;
  max_marks: string | null;
  marks: string | null;
  grade_text: string | null;
  criteria: { name: string; marks: number | null; max: number | null }[] | null;
  pct: number | null;
  class_avg_pct: number | null;
}

export interface CampusAmcat {
  rounds: AmcatRound[];
  sections: { name: string; avg: number | null; takers: number }[];
}

/** PRIME coding domain delivery against allocated hours (from the delivery tracker). */
export interface CampusDelivery {
  allocated: number;
  planned: number;
  /** Verified hours. */
  delivered: number;
  /** Hours awaiting verification. */
  pending: number;
  classes: number;
  rejected: number;
  /** Verified classes left out for impossible durations. */
  invalid: number;
  trainer_count: number;
  attendance: number | null;
  last_class: string | null;
  sections: {
    program: string;
    batch_year: number | null;
    section: string | null;
    students: number | null;
    allocated: number;
    planned: number;
    delivered: number;
    pending: number;
    classes: number;
    last_class: string | null;
  }[];
  /** Per trainer: tracker hours beside the PRIME coding hours in the LMS time table. */
  trainers: {
    name: string;
    /** Verified tracker hours. */
    hours: number;
    /** Tracker hours awaiting verification. */
    pending_hours: number;
    classes: number;
    attendance: number | null;
    last_class: string | null;
    /** False for an LMS instructor with PRIME coding classes but nothing in the tracker. */
    in_tracker: boolean;
    /** The LMS spelling, when it differs from the tracker's. */
    lms_name: string | null;
    /** Null when the trainer has no PRIME coding classes in the LMS. */
    lms_hours: number | null;
    lms_classes: number | null;
  }[];
  weeks: { week: string; hours: number }[];
  topics: {
    curriculum: string;
    topic: string;
    topic_order: number;
    subtopics: number;
    hours: number;
    classes: number;
    first_class: string | null;
    last_class: string | null;
  }[];
  syncedAt: string | null;
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
  timeline: {
    week: string;
    tests: number;
    avg_pct: number | null;
    participation: number | null;
  }[];
  students: CampusStudentRow[];
  attendance: CampusAttendance;
  amcat: CampusAmcat;
  exams: CampusExams;
  /** Cohorts: program and admission year; `key` is the batch filter value ("BCA:2025"). */
  batches: { key: string; program: string; year: number; students: number }[];
  now: string;
  syncedAt: string | null;
  /** Null when the campus has no PRIME delivery records. */
  delivery: CampusDelivery | null;
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
  exams: StudentExam[];
  attendance: {
    subjects: {
      subject: string;
      sessions: number;
      present: number;
      pct: number | null;
      last_date: string | null;
      prime: boolean;
    }[];
    weeks: { week: string; sessions: number; present: number; pct: number | null }[];
  };
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

export const useCampusDetail = (campus: number | undefined, batch: string | undefined) =>
  useQuery({
    queryKey: ['assessments', 'campus', campus, batch],
    queryFn: () => get<CampusDetail>({ view: 'campus', campus, batch }),
    enabled: campus !== undefined,
    ...options,
  });

/** A test with unusual scores, with its campus, for the reports. */
export interface FlaggedTest {
  campus: string;
  name: string;
  category: string;
  submitted: number;
  released: string | null;
  integrity: Integrity;
}

/**
 * The tests with unusually high, uniform scores at the named campuses (and batch), for the PDF
 * reports: one request per campus, side by side. A campus that fails to load is left out.
 */
export async function fetchFlaggedTests(
  campusNames: string[],
  batch?: string
): Promise<FlaggedTest[]> {
  const { campuses } = await get<{ campuses: CampusOverview[] }>({ view: 'campuses' });
  const wanted = campuses.filter((campus) => campusNames.includes(campus.name));
  const details = await Promise.all(
    wanted.map((campus) =>
      get<CampusDetail>({ view: 'campus', campus: campus.id, batch })
        .then((detail) => ({ campus, detail }))
        .catch(() => null)
    )
  );
  return details.flatMap((entry) => {
    if (!entry) return [];
    const { campus, detail } = entry;
    const tests: CampusTest[] = [
      ...detail.subjectTests,
      ...detail.subjects.flatMap((subject) =>
        subject.modules.flatMap((module) => [
          ...module.tests,
          ...module.folders.flatMap((folder) => folder.tests),
        ])
      ),
    ];
    return tests
      .filter((test) => test.integrity)
      .map((test) => ({
        campus: campus.name,
        name: test.name,
        category: test.category,
        submitted: test.submitted,
        released: test.released_at,
        integrity: test.integrity!,
      }));
  });
}

export const useTestDetail = (
  campus: number | undefined,
  batch: string | undefined,
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

/** Per-student numbers for the students table. */
export interface StudentMetrics {
  attendance: number | null;
  prime_attendance: number | null;
  /** AMCAT sittings in date order: [date, average score]. */
  amcat: [string, number][] | null;
  test_avg: number | null;
  submitted: number | null;
  released: number | null;
  /** Attendance % per week, last ten weeks (oldest first). */
  attendance_weeks: number[] | null;
  /** Score % on each PRIME test taken, in release order (last ten). */
  test_trend: number[] | null;
  /** Average % in internal exams (Midterms, End-term). */
  exam_avg: number | null;
}

export const useStudentMetrics = (enabled = true) =>
  useQuery({
    queryKey: ['assessments', 'metrics'],
    queryFn: () => get<{ students: Record<string, StudentMetrics> }>({ view: 'metrics' }),
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
