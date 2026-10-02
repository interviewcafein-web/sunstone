import { useMemo } from 'react';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';

import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import { fetchPlatformSummary, type PlatformSummary } from '@/lib/coding-profiles/summaries';
import { ProfileError, type PlatformId } from '@/lib/coding-profiles/types';
import type { Student } from '@/lib/students/types';

export const SUMMARY_QUERY_KEY = 'platform-summary';

export type SummaryQuery = UseQueryResult<PlatformSummary, Error>;

export const summaryKey = (platform: PlatformId, handle: string) => `${platform}:${handle}`;

/** One query per (platform, handle) across the given students, keyed by `summaryKey`. */
export function useStudentSummaries(students: Student[]) {
  const targets = useMemo(() => {
    const seen = new Map<string, { platform: PlatformId; handle: string }>();
    for (const student of students) {
      for (const { id } of PLATFORMS) {
        const handle = student.handles[id];
        if (handle) seen.set(summaryKey(id, handle), { platform: id, handle });
      }
    }
    return [...seen.values()];
  }, [students]);

  const results = useQueries({
    queries: targets.map(({ platform, handle }) => ({
      queryKey: [SUMMARY_QUERY_KEY, platform, handle],
      queryFn: () => fetchPlatformSummary(platform, handle),
      staleTime: 1000 * 60 * 30,
      // A wrong handle or a missing relay will not fix itself on retry; rate limits do
      // clear, so back off and try those a few more times.
      retry: (failureCount: number, error: Error) => {
        if (!(error instanceof ProfileError)) return false;
        if (error.kind === 'rate_limited') return failureCount < 4;
        return error.kind === 'network' && failureCount < 1;
      },
      retryDelay: (attempt: number) => Math.min(2000 * 2 ** attempt, 20000) + Math.random() * 1000,
    })),
  });

  const byKey = new Map<string, SummaryQuery>();
  targets.forEach(({ platform, handle }, index) => {
    byKey.set(summaryKey(platform, handle), results[index]);
  });

  return {
    byKey,
    total: results.length,
    settled: results.filter((result) => !result.isPending).length,
  };
}
