// The Placements page's numbers (api/placements.ts).

import { useQuery } from '@tanstack/react-query';

import type { PlacementKind, PlacementsResponse } from './placements';

export const usePlacements = (kind: PlacementKind, campus?: number) =>
  useQuery({
    queryKey: ['placements', kind, campus ?? null],
    queryFn: async () => {
      const response = await fetch(
        `/api/placements?kind=${kind}${campus ? `&campus=${campus}` : ''}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Placements could not be loaded.');
      return data as PlacementsResponse;
    },
    staleTime: 5 * 60_000,
  });
