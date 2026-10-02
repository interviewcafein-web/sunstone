import type { Handles, PlatformId } from '../coding-profiles/types';

export interface Student {
  /** Stable across sheet edits; derived server-side so no contact detail reaches the browser. */
  id: string;
  name: string;
  campus: string;
  course: string;
  /** Year of passing. */
  batch: string;
  handles: Handles;
  /** Platforms where the sheet has an entry that is not a usable username. */
  invalid: PlatformId[];
}

export interface StudentsResponse {
  students: Student[];
  fetchedAt: string;
}
