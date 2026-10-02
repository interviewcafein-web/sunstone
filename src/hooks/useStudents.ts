import { useQuery } from '@tanstack/react-query';

import type { StudentsResponse } from '@/lib/students/types';

export const SHEET_POLL_MS = 60_000;

async function fetchStudents(): Promise<StudentsResponse> {
  const response = await fetch('/api/students');
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.students) {
    throw new Error(body?.error ?? 'The student list could not be loaded.');
  }
  return body;
}

/** The sheet is the source of truth, so poll it: new form responses show up within a minute. */
export function useStudents() {
  return useQuery({
    queryKey: ['students'],
    queryFn: fetchStudents,
    staleTime: 0,
    refetchInterval: SHEET_POLL_MS,
    refetchOnWindowFocus: true,
  });
}
