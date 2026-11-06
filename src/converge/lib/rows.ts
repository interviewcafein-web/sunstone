// One table row per student: the roster entry joined with their LMS numbers (the metrics view
// of api/assessments.ts, keyed by username = slug).

import type { StudentMetrics } from '@/lib/assessments';
import { parseBatch } from '@/lib/cohorts';
import type { Student } from '@/lib/students/types';

import { isSuper100 } from './subjects';

export type SortKey = 'name' | 'domain' | 'elq' | 'amcat' | 'attendance' | 'exams';

export interface Row {
  student: Student;
  metrics?: StudentMetrics;
  super100: boolean;
  /** PRIME domain test average, %. */
  domain: number | null;
  /** Communication and aptitude (ELQ) average, %. */
  elq: number | null;
  /** True while the server's numbers do not split domain and ELQ yet: `domain` is all PRIME tests. */
  combined: boolean;
  /** Average section score of the latest AMCAT sitting. */
  amcat: number | null;
  attendance: number | null;
  exams: number | null;
}

export function toRow(student: Student, metrics?: StudentMetrics): Row {
  const split = metrics !== undefined && 'domain_avg' in metrics;
  return {
    student,
    metrics,
    super100: isSuper100(student),
    domain: (split ? metrics.domain_avg : metrics?.test_avg) ?? null,
    elq: (split ? metrics.elq_avg : null) ?? null,
    combined: metrics !== undefined && !split,
    amcat: metrics?.amcat?.at(-1)?.[1] ?? null,
    attendance: metrics?.attendance ?? null,
    exams: metrics?.exam_avg ?? null,
  };
}

const score = (row: Row, sort: Exclude<SortKey, 'name'>) => row[sort] ?? -1;

export function sortRows(rows: Row[], sort: SortKey = 'name') {
  const byName = (a: Row, b: Row) => a.student.name.localeCompare(b.student.name);
  if (sort === 'name') return [...rows].sort(byName);
  return [...rows].sort((a, b) => score(b, sort) - score(a, sort) || byName(a, b));
}

/** The mean of the values that are known, rounded; null when none are. */
export function mean(values: (number | null | undefined)[]): number | null {
  const known = values.filter((value): value is number => typeof value === 'number');
  return known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null;
}

/** Does the student belong to a batch filter value ("BBA:2025", "BBA:" or "2025")? */
export function inBatch(student: Student, batch: string | undefined) {
  const { year, program } = parseBatch(batch);
  return (!year || student.batch === year) && (!program || student.course === program);
}

export const unique = (values: (string | undefined | null)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

/** Students per program: { BBA: 1709, MBA: 906 }. */
export function byProgram(students: Student[]) {
  const counts: Record<string, number> = {};
  for (const student of students) counts[student.course] = (counts[student.course] ?? 0) + 1;
  return counts;
}
