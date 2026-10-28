import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeyFor } from '@/hooks/useStudentSummaries';
import { useStudents } from '@/hooks/useStudents';
import { useStudentMetrics } from '@/lib/assessments';
import type { PlatformSummary } from '@/lib/coding-profiles/summaries';
import { buildInsights } from '@/lib/insights';
import { loadSummaries } from '@/lib/statsCache';

/**
 * Every student the viewer may see, scored on the five fronts (src/lib/insights.ts): the
 * 360° page and the campus page both start from this.
 */
export function useInsightRows() {
  const client = useQueryClient();
  const students = useStudents();
  const metrics = useStudentMetrics();
  // The saved coding numbers (the same query the students page uses, so usually cached).
  const saved = useQuery({
    queryKey: ['saved-summaries'],
    queryFn: ({ client: queryClient }) => loadSummaries(queryClient, queryKeyFor),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const rows = useMemo(() => {
    if (!students.data) return [];
    return buildInsights(students.data.students, metrics.data?.students, (platform, handle) =>
      client.getQueryData<PlatformSummary>(queryKeyFor(platform, handle))
    );
    // saved.dataUpdatedAt: re-read the coding numbers once they are in the cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.data, metrics.data, saved.dataUpdatedAt, client]);

  return {
    rows,
    isPending: students.isPending || metrics.isPending,
    error: students.error,
  };
}
