import { useQuery } from '@tanstack/react-query';

import { redirectToLogin } from '@/lib/session';
import type { Student, StudentsResponse } from '@/lib/students/types';

// The list changes when the import runs (or, without a database, when the form sheet
// changes): checking every few minutes is plenty, and lets the database sleep when idle.
export const STUDENTS_POLL_MS = 5 * 60_000;

async function fetchStudents(): Promise<StudentsResponse> {
  const response = await fetch('/api/students');
  // The full list needs a login; a session that expired mid-visit goes back to log in.
  if (response.status === 401) {
    redirectToLogin();
    throw new Error('Please log in again.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.students) {
    throw new Error(body?.error ?? 'The student list could not be loaded.');
  }
  return body;
}

/** Every student on the platform (staff only). */
export function useStudents() {
  return useQuery({
    queryKey: ['students'],
    queryFn: fetchStudents,
    staleTime: 0,
    refetchInterval: STUDENTS_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** One student by username (or an old profile address); public, for the profile and card pages. */
export function useStudent(slug: string) {
  return useQuery({
    queryKey: ['student', slug],
    queryFn: async (): Promise<Student | null> => {
      const response = await fetch(`/api/student?s=${encodeURIComponent(slug)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('The profile could not be loaded.');
      return ((await response.json()) as { student: Student }).student;
    },
    staleTime: 60_000,
  });
}
