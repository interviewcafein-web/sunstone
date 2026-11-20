// The PRIME Domain page's numbers (api/prime.ts).

import { useQuery } from '@tanstack/react-query';

import type { FitMatrix, PlacementMeasure, PlacementsResponse } from '@/lib/placements';

export interface PrimeSubjectRow {
  campus_id: number;
  campus: string;
  program: string;
  admission_year: number;
  subject: string;
  students: number;
  created: number;
  published: number;
  assigned: number;
  attempted: number;
  graded: number;
  avg_score: number | null;
  modules: number;
  modules_started: number;
  attendance: number | null;
  credits: number | null;
  sections: number;
  classes: number;
  /** Hours taught: HQ's typed hours when set, else the LMS timetable's. */
  total_hours: number | null;
  hours_per_section: number | null;
  /** Faculty: HQ's typed names when set, else the LMS timetable's. */
  trainers: string | null;
  last_class: string | null;
  /** The LMS timetable's own hours and faculty. */
  lms_hours_per_section: number | null;
  lms_trainers: string | null;
  taught_source: 'hq' | 'lms' | null;
  trainers_source: 'hq' | 'lms' | null;
  planned_hours: number | null;
  planned_source: 'hq' | 'credits' | null;
  planned_by: string | null;
}

export interface PrimeAmcatRow {
  campus_id: number;
  campus: string;
  program: string;
  admission_year: number;
  students: number;
  with_sitting: number;
  sittings: number;
  latest_avg: number | null;
  sections: Record<string, number> | null;
}

export interface OptInRow {
  opted_in: boolean;
  program: string | null;
  admission_year: number | null;
  overall: boolean;
  students: number;
  ft_placed: number;
  ft_median: number | null;
  ft_highest: number | null;
  in_placed: number;
  in_median: number | null;
}

export interface PrimeResponse {
  campuses: { id: number; name: string }[];
  subjects: PrimeSubjectRow[];
  amcat: PrimeAmcatRow[];
  optIn: {
    minSide: number;
    rows: OptInRow[];
    batches: {
      program: string;
      admission_year: number;
      opted_in: number;
      not_opted_in: number;
      placed: number;
    }[];
  };
  placement: {
    kind: 'full-time' | 'internship';
    totals: PlacementsResponse['totals'];
    measures: PlacementMeasure[];
    prep: PlacementsResponse['prep'];
    fit: FitMatrix | null;
    roles: PlacementsResponse['roles'];
  }[];
  hoursPerCredit: number;
  canEditPlanned: boolean;
  syncedAt: string | null;
}

export const primeKey = (campus?: number) => ['prime', campus ?? null];

export const usePrime = (campus?: number) =>
  useQuery({
    queryKey: primeKey(campus),
    queryFn: async () => {
      const response = await fetch(`/api/prime${campus ? `?campus=${campus}` : ''}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'The PRIME overview could not be loaded.');
      return data as PrimeResponse;
    },
    staleTime: 5 * 60_000,
  });

export async function savePlannedHours(input: {
  campusId: number;
  program: string;
  admissionYear: number;
  subject: string;
  hours: number | null;
}) {
  const response = await fetch('/api/prime', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Planned hours could not be saved.');
}

/** HQ types the hours taught per section and the faculty (null or '' keeps the LMS's own). */
export async function saveTaught(input: {
  campusId: number;
  program: string;
  admissionYear: number;
  subject: string;
  hours: number | null;
  trainers: string | null;
}) {
  const response = await fetch('/api/prime', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, field: 'taught' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Hours taught could not be saved.');
}

export interface PersonSubject {
  subject: string;
  released: number;
  submitted: number;
  avg: number | null;
  classes: number | null;
  attended: number | null;
}

/** Some students' PRIME subjects, by username (for the domain-vs-role details). */
export const usePeopleSubjects = (slugs: string[]) =>
  useQuery({
    queryKey: ['prime-people', slugs],
    enabled: slugs.length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/prime?people=${encodeURIComponent(slugs.join(','))}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'The subjects could not be loaded.');
      return (data.subjects ?? {}) as Record<string, PersonSubject[]>;
    },
    staleTime: 5 * 60_000,
  });
