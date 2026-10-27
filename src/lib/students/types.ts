import type { Handles, PlatformId } from '../coding-profiles/types';

/** A student's standing in the LMS. Staff only: never sent on public profile responses. */
export interface StudentStatus {
  /** Kept out of placement drives; `until` is null for a permanent debarment. */
  debarred?: { reason: string | null; until: string | null };
  /** Flagged inactive in the LMS: dropped out, not attending, fees... */
  inactive?: { reason: string | null };
}

export interface Student {
  /** Stable across edits; derived server-side so no contact detail reaches the browser. */
  id: string;
  /** Short, readable URL key: /s/{slug}, e.g. "ankit.vishwakarma". */
  slug: string;
  name: string;
  campus: string;
  course: string;
  /** Admission year. */
  batch: string;
  handles: Handles;
  /** Platforms where the sheet has an entry that is not a usable username. */
  invalid: PlatformId[];
  /** Staff only. */
  status?: StudentStatus;
}

export interface StudentsResponse {
  students: Student[];
  fetchedAt: string;
}
