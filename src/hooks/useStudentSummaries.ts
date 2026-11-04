import { useMemo } from 'react';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import type { PlatformSummary } from '@/lib/coding-profiles/summaries';
import { ProfileError, type PlatformId } from '@/lib/coding-profiles/types';
import { loadSummaries } from '@/lib/statsCache';
import type { Student } from '@/lib/students/types';

export const SUMMARY_QUERY_KEY = 'platform-summary';

export type SummaryQuery = UseQueryResult<PlatformSummary, Error>;

export const summaryKey = (platform: PlatformId, handle: string) => `${platform}:${handle}`;

export const queryKeyFor = (platform: PlatformId, handle: string) => [
  SUMMARY_QUERY_KEY,
  platform,
  handle,
];

/**
 * One query per (platform, handle) across the given students, keyed by `summaryKey`.
 *
 * The numbers are the saved ones from the database, refreshed every night from the
 * platforms by scripts/sync-coding.ts (GitHub Actions). Browsers no longer re-check every
 * username: that ran through Vercel for thousands of requests a visit and used up its plan.
 * A username without saved numbers yet shows as such until the next nightly refresh; one
 * student's profile page still loads live (useCodingProfiles).
 */
export function useStudentSummaries(students: Student[]) {
  const saved = useQuery({
    queryKey: ['saved-summaries'],
    queryFn: ({ client }) => loadSummaries(client, queryKeyFor),
    staleTime: 5 * 60_000,
    retry: false,
  });
  // Live fetching waits for the saved numbers, so it only refreshes what is out of date.
  const ready = !saved.isPending;

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
      queryKey: queryKeyFor(platform, handle),
      // Saved numbers are already in the cache (loadSummaries) and stay; this only runs for
      // a username with none saved yet.
      queryFn: (): Promise<PlatformSummary> =>
        Promise.reject(
          new ProfileError('upstream', 'No numbers yet: they are refreshed every night.')
        ),
      enabled: ready,
      staleTime: Infinity,
      retry: false,
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
    /** When the coding numbers were last refreshed (the newest saved one), if known. */
    updatedAt: saved.data?.latest ?? null,
    /** Saved numbers being refreshed from the platforms right now. */
    refreshing: results.filter((result) => result.isFetching && !result.isPending).length,
  };
}
