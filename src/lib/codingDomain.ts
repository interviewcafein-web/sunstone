// Vertex's PRIME Coding Domain page: the API's shapes (api/_coding.ts via GET /api/prime), the
// page's address, and the rules every tab shares (AMCAT skills and employability, cohort
// movement between cycles, readiness bands, the placement funnel).

import { useQuery } from '@tanstack/react-query';

// --- From the API ----------------------------------------------------------------------------

export interface Cycle {
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface CycleScores {
  /** Comms (English Comprehension, WriteX), aptitude (quant, logical), domain (coding modules). */
  c: number | null;
  a: number | null;
  d: number | null;
  /** Each AMCAT module's score in that cycle. */
  m: Record<string, number>;
  on: string;
}

export interface CodingStudent {
  slug: string;
  name: string;
  campusId: number | null;
  campus: string;
  program: string;
  year: number | null;
  cohorts: string[];
  /** Centre of Excellence track, e.g. "DE Tech". */
  track: string | null;
  placed: 'full-time' | 'internship' | null;
  offers: { company: string | null; role: string | null; fullTime: boolean }[];
  pipeline: { eligible: number; applied: number; shortlisted: number; interviews: number };
  /** By cycle key. */
  amcat: Record<string, CycleScores>;
  /** LMS AMCAT Mock Test n → score %, or null when released and not taken. */
  mocks: Record<string, number | null>;
  solved: number | null;
  attendance: number | null;
}

export interface DeliverySection {
  campus_code: string;
  program: string;
  batch_year: number;
  section: string | null;
  students: number | null;
  /** Planned and allocated hours for the section. */
  planned: number;
  allocated: number;
  /** Classes by tracker status (pending and rejected include any duration). */
  verified: number;
  pending: number;
  rejected: number;
  verified_hours: number;
  pending_hours: number;
  rejected_hours: number;
  /** Average length of a verified class. */
  class_minutes: number | null;
  attendance: number | null;
  last_class: string | null;
  trainers: string | null;
}

export interface DeliveryTopicRow {
  campus_code: string;
  program: string;
  batch_year: number;
  section: string | null;
  curriculum: string;
  topic: string;
  verified: number;
  pending: number;
  rejected: number;
  hours: number;
  /** Distinct subtopics with a verified class. */
  subtopics: number;
}

export interface SyllabusTopic {
  curriculum: string;
  program: string;
  batch_years: number[];
  topic: string;
  topic_order: number;
  subtopics: number;
}

export interface DeliveryTrainer {
  trainer: string;
  campus_code: string;
  program: string;
  batch_year: number;
  section: string | null;
  verified: number;
  pending: number;
  rejected: number;
  hours: number;
  last_logged: string | null;
}

export interface CodingResponse {
  students: CodingStudent[];
  campuses: { id: number; name: string; code: string | null }[];
  delivery: {
    sections: DeliverySection[];
    taught: DeliveryTopicRow[];
    topics: SyllabusTopic[];
    trainers: DeliveryTrainer[];
    syncedAt: string | null;
  };
  cycles: Cycle[];
  skills: { comms: string[]; aptitude: string[]; domain: string[] };
  syncedAt: string | null;
}

async function load(campus?: number) {
  const response = await fetch(`/api/prime${campus ? `?campus=${campus}` : ''}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'The PRIME coding numbers could not be loaded.');
  return data as CodingResponse;
}

export const useCodingDomain = (campus?: number) =>
  useQuery({
    queryKey: ['coding-domain', campus ?? null],
    queryFn: () => load(campus),
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });

// --- The page's address -------------------------------------------------------------------------

export type CodingTab = 'amcat' | 'readiness' | 'delivery' | 'movement';
export const CODING_TABS: CodingTab[] = ['amcat', 'readiness', 'delivery', 'movement'];

export interface CodingSearch {
  tab?: CodingTab;
  campus?: number;
  /** "B.Tech", "BCA", "MCA", "BE". */
  program?: string;
  /** Admission year. */
  batch?: number;
  /** Delivery only: a section letter. */
  section?: string;
  /** AMCAT cycle key; the latest with sittings when absent. */
  cycle?: string;
  /** AMCAT pass mark, 45 when absent. */
  pass?: number;
  /** Centre of Excellence track, or "any" for every COE student. */
  track?: string;
}

const positive = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};
const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : undefined;

export const validateCodingSearch = (search: Record<string, unknown>): CodingSearch => {
  const pass = Number(search.pass);
  return {
    tab: CODING_TABS.includes(search.tab as CodingTab) ? (search.tab as CodingTab) : undefined,
    campus: positive(search.campus),
    program: text(search.program),
    batch: positive(search.batch),
    section: text(search.section),
    cycle: text(search.cycle),
    pass: Number.isFinite(pass) && pass > 0 && pass <= 100 && pass !== 45 ? pass : undefined,
    track: text(search.track),
  };
};

// --- Shared rules ------------------------------------------------------------------------------

export const DEFAULT_PASS = 45;

export const SKILL_LABELS = { c: 'Comms', a: 'Aptitude', d: 'Domain' } as const;

/** The students under the page's filters (campus is applied by the API). */
export function filterStudents(rows: CodingStudent[], search: CodingSearch) {
  return rows.filter(
    (row) =>
      (!search.program || row.program === search.program) &&
      (!search.batch || row.year === search.batch) &&
      (!search.track || (search.track === 'any' ? Boolean(row.track) : row.track === search.track))
  );
}

/** Cycles that have sittings among these students, oldest first. */
export const cyclesWithData = (rows: CodingStudent[], cycles: Cycle[]) =>
  cycles.filter((cycle) => rows.some((row) => row.amcat[cycle.key]));

/**
 * Employability in a cycle at a pass mark, as on the AMCAT dashboard: basic = comms and
 * aptitude both at the pass mark; overall = basic and domain too. null when the student was not
 * judged (did not sit the cycle, or a needed skill is missing).
 */
export function employable(
  scores: CycleScores | undefined,
  pass: number,
  level: 'basic' | 'overall' = 'basic'
): boolean | null {
  if (!scores || scores.c == null || scores.a == null) return null;
  const basic = scores.c >= pass && scores.a >= pass;
  if (level === 'basic') return basic;
  if (scores.d == null) return null;
  return basic && scores.d >= pass;
}

export type Movement = 'up' | 'down' | 'stay-yes' | 'stay-no';

export const MOVEMENT_LABELS: Record<Movement, string> = {
  up: 'Upward (No → Yes)',
  down: 'Downward (Yes → No)',
  'stay-yes': 'No Movement (Yes → Yes)',
  'stay-no': 'No Movement (No → No)',
};

/**
 * Cohort movement between two cycles: whether the student was employable (at the pass mark, at
 * the chosen level) in the earlier cycle and in the later one. null when not judged in both.
 */
export function movementOf(
  row: CodingStudent,
  previous: string,
  current: string,
  pass: number,
  level: 'basic' | 'overall' = 'basic'
): Movement | null {
  const before = employable(row.amcat[previous], pass, level);
  const after = employable(row.amcat[current], pass, level);
  if (before === null || after === null) return null;
  if (!before && after) return 'up';
  if (before && !after) return 'down';
  return before ? 'stay-yes' : 'stay-no';
}

/** Mock test numbers present among these students, in order ("1", "2", …). */
export const mockNumbers = (rows: CodingStudent[]) =>
  [...new Set(rows.flatMap((row) => Object.keys(row.mocks)))].sort((a, b) => Number(a) - Number(b));

/** The average of a student's taken mock tests (released but not taken ones are left out). */
export function mockAverage(row: CodingStudent): number | null {
  const taken = Object.values(row.mocks).filter((value): value is number => value != null);
  return taken.length ? Math.round(taken.reduce((a, b) => a + b, 0) / taken.length) : null;
}

export const BANDS = [
  { key: 'high', label: 'High Ready (≥ 75%)', min: 75, color: '#16a34a' },
  { key: 'eligible', label: 'Eligible (60–74%)', min: 60, color: '#86efac' },
  { key: 'developing', label: 'Developing (40–59%)', min: 40, color: '#facc15' },
  { key: 'low', label: 'Needs Improvement (< 40%)', min: 0, color: '#f87171' },
] as const;

export const bandOf = (score: number | null) =>
  score == null ? null : (BANDS.find((band) => score >= band.min) ?? BANDS[BANDS.length - 1]);

/**
 * The placement funnel, from the LMS: every student in view, eligible for at least one
 * opportunity (or applied to one), applied, shortlisted in a round, reached an interview round,
 * and got an offer. Each stage includes everyone who got further, so it only narrows.
 */
export const FUNNEL = [
  { key: 'registered', label: 'Registered', test: () => true },
  {
    key: 'eligible',
    label: 'Eligible',
    test: (row: CodingStudent) =>
      row.pipeline.eligible > 0 || row.pipeline.applied > 0 || row.placed !== null,
  },
  {
    key: 'applied',
    label: 'Applied',
    test: (row: CodingStudent) => row.pipeline.applied > 0 || row.placed !== null,
  },
  {
    key: 'shortlisted',
    label: 'Shortlisted',
    // Reaching an interview round or an offer means they were shortlisted on the way.
    test: (row: CodingStudent) =>
      row.pipeline.shortlisted > 0 || row.pipeline.interviews > 0 || row.placed !== null,
  },
  {
    key: 'interviewed',
    label: 'Interviewed',
    test: (row: CodingStudent) => row.pipeline.interviews > 0 || row.placed !== null,
  },
  { key: 'offered', label: 'Offered', test: (row: CodingStudent) => row.placed !== null },
] as const;

/** A student's furthest stage in the funnel. */
export const stageOf = (row: CodingStudent) =>
  [...FUNNEL].reverse().find((stage) => stage.test(row))!;

export const placedLabel = (placed: CodingStudent['placed']) =>
  placed === 'full-time' ? 'Placed (Full-Time)' : placed === 'internship' ? 'Internship' : null;

export const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((100 * part) / whole) : null;

export const average = (values: (number | null | undefined)[]) => {
  const known = values.filter((value): value is number => typeof value === 'number');
  return known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null;
};
