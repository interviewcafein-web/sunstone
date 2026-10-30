// The 360° view: every student scored on five fronts (coding, attendance, PRIME tests, AMCAT,
// internal exams), rolled up by campus or batch, and the pain points found in them.
//
// Each front is a 0–100 score so they can sit side by side. Coding is the best solved count on
// one DSA platform (the same rule as the zones), capped at 100; the others are already
// percentages or AMCAT scores. A student with no data on a front is left out of that front
// rather than counted as zero, and the share of students with data is shown as coverage.

import type { PlatformSummary } from './coding-profiles/summaries';
import type { PlatformId } from './coding-profiles/types';
import type { StudentMetrics } from './assessments';
import type { Student } from './students/types';
import { ZONE_BASIS, zoneOf, type ZoneId } from './students/zones';

export type DimensionId = 'coding' | 'attendance' | 'tests' | 'amcat' | 'exams';

export interface Dimension {
  id: DimensionId;
  label: string;
  short: string;
  /** What the score means, for tooltips and captions. */
  measure: string;
  /** At or above: doing well. */
  good: number;
  /** Below: at risk. */
  risk: number;
  /** Chart colour (fixed hex: the theme's colour scales flip in dark mode). */
  color: string;
  suffix: string;
}

export const DIMENSIONS: Dimension[] = [
  {
    id: 'coding',
    label: 'Coding practice',
    short: 'Coding',
    measure: 'Best solved count on LeetCode, GFG, Codeforces or CodeChef (100+ is full marks)',
    good: 100,
    risk: 25,
    color: '#f59e0b',
    suffix: '',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    short: 'Attendance',
    measure: 'Classes attended, all subjects',
    good: 85,
    risk: 75,
    color: '#10b981',
    suffix: '%',
  },
  {
    id: 'tests',
    label: 'PRIME Mock Tests',
    short: 'Mock Tests',
    measure: 'Average score on submitted PRIME domain tests',
    good: 70,
    risk: 50,
    color: '#3b82f6',
    suffix: '%',
  },
  {
    id: 'amcat',
    label: 'AMCAT',
    short: 'AMCAT',
    measure: 'Latest AMCAT sitting, average of its sections',
    good: 60,
    risk: 40,
    color: '#8b5cf6',
    suffix: '',
  },
  {
    id: 'exams',
    label: 'Internal exams',
    short: 'Exams',
    measure: 'Average in Midterms and End-term',
    good: 60,
    risk: 40,
    color: '#ec4899',
    suffix: '%',
  },
];

export const dimensionById = (id: DimensionId) => DIMENSIONS.find((item) => item.id === id)!;

export type Band = 'good' | 'ok' | 'risk' | 'none';

export function bandOf(dimension: Dimension, value: number | null | undefined): Band {
  if (value == null) return 'none';
  if (value >= dimension.good) return 'good';
  if (value >= dimension.risk) return 'ok';
  return 'risk';
}

export const BAND_COLORS: Record<Band, string> = {
  good: '#10b981',
  ok: '#f59e0b',
  risk: '#ef4444',
  none: '#94a3b8',
};

/** A 0–100 position on a front's own scale, for heat colours and radar charts. */
export function normalized(dimension: Dimension, value: number) {
  return dimension.id === 'coding' ? Math.min(100, value) : Math.max(0, Math.min(100, value));
}

export interface StudentInsight {
  student: Student;
  scores: Record<DimensionId, number | null>;
  /** Raw best solved count (scores.coding is capped at 100). */
  solved: number | null;
  zone: ZoneId;
  /** Has a usable username on a platform that decides the zone (stats may not be loaded yet). */
  linked: boolean;
  /** Any coding activity in the last completed week; null when unknown. */
  activeLastWeek: boolean | null;
  /** Mean of the fronts with data. */
  overall: number | null;
  /** Fronts where the student is in the risk band. */
  risks: DimensionId[];
  participation: number | null;
  attendanceWeeks: number[];
}

export function buildInsights(
  students: Student[],
  metrics: Record<string, StudentMetrics> | undefined,
  summaryFor: (platform: PlatformId, handle: string) => PlatformSummary | undefined
): StudentInsight[] {
  return students.map((student) => {
    const m = metrics?.[student.slug];
    const solved: Partial<Record<PlatformId, number>> = {};
    let activity: boolean | null = null;
    for (const [platform, handle] of Object.entries(student.handles) as [PlatformId, string][]) {
      if (!handle) continue;
      const summary = summaryFor(platform, handle);
      if (!summary) continue;
      if (ZONE_BASIS.includes(platform)) solved[platform] = summary.value;
      if (summary.weeks?.length) activity = activity || (summary.weeks.at(-1) ?? 0) > 0;
    }
    const { zone, count } = zoneOf(solved);
    const latestAmcat = m?.amcat?.length ? m.amcat[m.amcat.length - 1][1] : null;
    const scores: Record<DimensionId, number | null> = {
      coding: count === undefined ? null : Math.min(100, count),
      attendance: m?.attendance ?? null,
      tests: m?.test_avg ?? null,
      amcat: latestAmcat,
      exams: m?.exam_avg ?? null,
    };
    const present = Object.values(scores).filter((value): value is number => value !== null);
    return {
      student,
      scores,
      solved: count ?? null,
      zone,
      linked: ZONE_BASIS.some(
        (platform) => student.handles[platform] && !student.invalid.includes(platform)
      ),
      activeLastWeek: activity,
      overall: present.length
        ? Math.round(present.reduce((sum, value) => sum + value, 0) / present.length)
        : null,
      risks: DIMENSIONS.filter((d) => bandOf(d, scores[d.id]) === 'risk').map((d) => d.id),
      participation: m?.released ? Math.round(((m.submitted ?? 0) / m.released) * 100) : null,
      attendanceWeeks: m?.attendance_weeks ?? [],
    };
  });
}

export interface DimensionStats {
  /** Mean over students with data. */
  avg: number | null;
  /** Students with data. */
  n: number;
  /** Share of the group with data, 0–100. */
  coverage: number;
  good: number;
  ok: number;
  risk: number;
  /** Students per 20-point bucket (0–19 … 80–100). */
  histogram: number[];
}

export interface GroupStats {
  key: string;
  students: number;
  dims: Record<DimensionId, DimensionStats>;
  overall: number | null;
  /** Students at risk on three fronts or more. */
  critical: number;
  participation: number | null;
  /** Mean weekly attendance across the group, oldest first. */
  attendanceWeeks: number[];
  /** Coding zones: green, yellow, orange, red, none. */
  zones: Record<ZoneId, number>;
  activeLastWeek: number;
  /** Linked students whose activity is known. */
  activityKnown: number;
  /** Students with no usable DSA username in the form. */
  unlinked: number;
}

const mean = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

export function groupStats(key: string, rows: StudentInsight[]): GroupStats {
  const dims = Object.fromEntries(
    DIMENSIONS.map((dimension) => {
      const values = rows
        .map((row) => row.scores[dimension.id])
        .filter((value): value is number => value !== null);
      const histogram = [0, 0, 0, 0, 0];
      for (const value of values) {
        histogram[Math.min(4, Math.floor(normalized(dimension, value) / 20))] += 1;
      }
      return [
        dimension.id,
        {
          avg: mean(values),
          n: values.length,
          coverage: rows.length ? Math.round((values.length / rows.length) * 100) : 0,
          good: values.filter((value) => bandOf(dimension, value) === 'good').length,
          ok: values.filter((value) => bandOf(dimension, value) === 'ok').length,
          risk: values.filter((value) => bandOf(dimension, value) === 'risk').length,
          histogram,
        },
      ];
    })
  ) as Record<DimensionId, DimensionStats>;

  // Weekly attendance, aligned on the most recent week.
  const longest = Math.max(0, ...rows.map((row) => row.attendanceWeeks.length));
  const attendanceWeeks: number[] = [];
  for (let back = longest - 1; back >= 0; back -= 1) {
    const week = rows
      .map((row) => row.attendanceWeeks[row.attendanceWeeks.length - 1 - back])
      .filter((value): value is number => typeof value === 'number');
    const avg = mean(week);
    if (avg !== null && week.length >= Math.min(5, rows.length)) attendanceWeeks.push(avg);
  }

  const zones = { green: 0, yellow: 0, orange: 0, red: 0, none: 0 } as Record<ZoneId, number>;
  for (const row of rows) zones[row.zone] += 1;
  const known = rows.filter((row) => row.activeLastWeek !== null);

  return {
    key,
    students: rows.length,
    dims,
    overall: mean(
      rows.map((row) => row.overall).filter((value): value is number => value !== null)
    ),
    critical: rows.filter((row) => row.risks.length >= 3).length,
    participation: mean(
      rows.map((row) => row.participation).filter((value): value is number => value !== null)
    ),
    attendanceWeeks,
    zones,
    activeLastWeek: known.filter((row) => row.activeLastWeek).length,
    activityKnown: known.length,
    unlinked: rows.filter((row) => !row.linked).length,
  };
}

export function groupBy(rows: StudentInsight[], keyOf: (row: StudentInsight) => string) {
  const groups = new Map<string, StudentInsight[]>();
  for (const row of rows) {
    const key = keyOf(row) || 'Unknown';
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, members]) => groupStats(key, members));
}

export type Severity = 'high' | 'medium' | 'low';

export interface PainPoint {
  severity: Severity;
  /** Front it concerns, for the icon and colour; none for cross-cutting ones. */
  dimension?: DimensionId;
  title: string;
  detail: string;
  /** Higher sorts first. */
  weight: number;
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/**
 * A front's name inside a sentence: "coding practice", "internal exams", but names that are
 * written in capitals keep them ("PRIME Mock Tests", "AMCAT").
 */
const inSentence = (label: string) =>
  /^[A-Z]{2,}/.test(label) ? label : label[0].toLowerCase() + label.slice(1);

/**
 * What needs attention in `scope`, most pressing first. With `groups` (campuses or batches)
 * it also points at the ones that trail the rest.
 */
export function findPainPoints(
  scope: GroupStats,
  groups: GroupStats[],
  groupNoun: string
): PainPoint[] {
  const points: PainPoint[] = [];
  const severityOf = (share: number): Severity =>
    share >= 40 ? 'high' : share >= 20 ? 'medium' : 'low';

  for (const dimension of DIMENSIONS) {
    const stats = scope.dims[dimension.id];
    if (stats.n >= 5) {
      const share = pct(stats.risk, stats.n);
      if (share >= 10) {
        points.push({
          severity: severityOf(share),
          dimension: dimension.id,
          title: `${share}% of students are at risk on ${inSentence(dimension.label)}`,
          detail: `${stats.risk.toLocaleString('en-IN')} of ${stats.n.toLocaleString('en-IN')} below ${dimension.risk}${dimension.suffix}${dimension.id === 'coding' ? ' solved' : ''}. Average ${stats.avg}${dimension.suffix}.`,
          weight: share,
        });
      }
    }
    // Fronts most students have no data on. For coding, only a missing username counts:
    // a linked profile whose numbers have not loaded yet is not the student's gap.
    const missing = dimension.id === 'coding' ? scope.unlinked : scope.students - stats.n;
    const covered = pct(scope.students - missing, scope.students);
    if (scope.students >= 10 && covered < 60) {
      points.push({
        severity: covered < 30 ? 'high' : 'medium',
        dimension: dimension.id,
        title:
          dimension.id === 'coding'
            ? `${100 - covered}% have no usable coding profile`
            : `${100 - covered}% have no ${dimension.label} data`,
        detail:
          dimension.id === 'coding'
            ? `${missing.toLocaleString('en-IN')} students: no LeetCode, GFG, Codeforces or CodeChef username in the form, or one that is not a username.`
            : dimension.id === 'amcat'
              ? `${missing.toLocaleString('en-IN')} students have not taken an AMCAT yet.`
              : `${missing.toLocaleString('en-IN')} students without ${inSentence(dimension.label)} records.`,
        weight: (100 - covered) * 0.8,
      });
    }
    // The group that trails most on this front.
    const ranked = groups
      .filter((group) => group.dims[dimension.id].n >= 10 && group.dims[dimension.id].avg !== null)
      .sort((a, b) => a.dims[dimension.id].avg! - b.dims[dimension.id].avg!);
    if (ranked.length >= 3 && stats.avg !== null) {
      const worst = ranked[0];
      const gap = stats.avg - worst.dims[dimension.id].avg!;
      if (gap >= 8) {
        points.push({
          severity: gap >= 15 ? 'high' : 'medium',
          dimension: dimension.id,
          title: `${worst.key} trails on ${inSentence(dimension.label)}`,
          detail: `${worst.dims[dimension.id].avg}${dimension.suffix} against ${stats.avg}${dimension.suffix} overall, lowest of ${ranked.length} ${groupNoun}.`,
          weight: gap * 2,
        });
      }
    }
  }

  const weeks = scope.attendanceWeeks;
  if (weeks.length >= 5) {
    const change = weeks[weeks.length - 1] - weeks[weeks.length - 5];
    if (change <= -5) {
      points.push({
        severity: change <= -10 ? 'high' : 'medium',
        dimension: 'attendance',
        title: `Attendance fell ${-change} points in four weeks`,
        detail: `From ${weeks[weeks.length - 5]}% to ${weeks[weeks.length - 1]}% a week.`,
        weight: -change * 3,
      });
    }
  }

  if (scope.activityKnown >= 10) {
    const idle = pct(scope.activityKnown - scope.activeLastWeek, scope.activityKnown);
    if (idle >= 50) {
      points.push({
        severity: idle >= 75 ? 'high' : 'medium',
        dimension: 'coding',
        title: `${idle}% did no coding practice last week`,
        detail: `Of ${scope.activityKnown.toLocaleString('en-IN')} students whose activity is visible on LeetCode, GitHub or Codeforces.`,
        weight: idle * 0.7,
      });
    }
  }

  if (scope.participation !== null && scope.participation < 70) {
    points.push({
      severity: scope.participation < 50 ? 'high' : 'medium',
      dimension: 'tests',
      title: `Only ${scope.participation}% of PRIME Mock Tests are attempted`,
      detail: 'Average share of released tests each student submitted.',
      weight: (100 - scope.participation) * 0.9,
    });
  }

  if (scope.critical > 0) {
    const share = pct(scope.critical, scope.students);
    points.push({
      severity: share >= 10 ? 'high' : 'medium',
      title: `${scope.critical.toLocaleString('en-IN')} students are at risk on 3 or more fronts`,
      detail: 'Start here: they are listed under "Students who need attention".',
      weight: 60 + share,
    });
  }

  return points.sort((a, b) => b.weight - a.weight);
}
