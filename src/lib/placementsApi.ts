// The Placements page's numbers (api/placements.ts).

import { useQuery } from '@tanstack/react-query';

import type { PlacementKind, PlacementsResponse } from './placements';

async function load(kind: PlacementKind, campus?: number) {
  const response = await fetch(`/api/placements?kind=${kind}${campus ? `&campus=${campus}` : ''}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Placements could not be loaded.');
  return data as PlacementsResponse;
}

/** Both kinds of offer for the PDF report: every campus, or the one campus named. */
export async function fetchReportPlacements(campusName?: string): Promise<PlacementsResponse[]> {
  const kinds: PlacementKind[] = ['full-time', 'internship'];
  const everyCampus = await Promise.all(kinds.map((kind) => load(kind)));
  if (!campusName) return everyCampus;
  const campus = everyCampus
    .flatMap((report) => report.campuses)
    .find((entry) => entry.name === campusName);
  return campus ? Promise.all(kinds.map((kind) => load(kind, campus.id))) : [];
}

export const usePlacements = (kind: PlacementKind, campus?: number) =>
  useQuery({
    queryKey: ['placements', kind, campus ?? null],
    queryFn: () => load(kind, campus),
    staleTime: 5 * 60_000,
  });
