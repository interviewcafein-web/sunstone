import { useEffect, useMemo } from 'react';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import { fetchPlatformSummary, type PlatformSummary } from '@/lib/coding-profiles/summaries';
import { ProfileError, type PlatformId } from '@/lib/coding-profiles/types';
import { loadSummaries, saveSummary, setSaving } from '@/lib/statsCache';
import type { Student } from '@/lib/students/types';

export const SUMMARY_QUERY_KEY = 'platform-summary';

export type SummaryQuery = UseQueryResult<PlatformSummary, Error>;

export const summaryKey = (platform: PlatformId, handle: string) => `${platform}:${handle}`;

const queryKeyFor = (platform: PlatformId, handle: string) => [SUMMARY_QUERY_KEY, platform, handle];

/**
 * One query per (platform, handle) across the given students, keyed by `summaryKey`.
 *
 * The saved numbers from the database load first and show at once; anything older than
 * half an hour is then refreshed from the platform in the background, and the fresh
 * numbers are saved back for the next visitor. Staff pages only (saving needs a login).
 */
export function useStudentSummaries(students: Student[]) {
  useEffect(() => setSaving(true), []);
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
      queryFn: async () => {
        const summary = await fetchPlatformSummary(platform, handle);
        saveSummary(platform, handle, summary);
        return summary;
      },
      enabled: ready,
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
    /** Saved numbers being refreshed from the platforms right now. */
    refreshing: results.filter((result) => result.isFetching && !result.isPending).length,
  };
}
