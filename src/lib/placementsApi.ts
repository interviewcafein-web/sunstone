// The Placements page's numbers (api/placements.ts).

import { useQuery } from '@tanstack/react-query';

import type { PlacementKind, PlacementSegment, PlacementsResponse } from './placements';

interface Filters {
  campus?: number;
  batch?: string;
  segment?: PlacementSegment;
}

async function load(kind: PlacementKind, campus?: number, filters: Omit<Filters, 'campus'> = {}) {
  const params = new URLSearchParams({ kind });
  if (campus) params.set('campus', String(campus));
  if (filters.batch) params.set('batch', filters.batch);
  if (filters.segment) params.set('segment', filters.segment);
  const response = await fetch(`/api/placements?${params}`);
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

export const usePlacements = (kind: PlacementKind, { campus, batch, segment }: Filters = {}) =>
  useQuery({
    queryKey: ['placements', kind, campus ?? null, batch ?? null, segment ?? null],
    queryFn: () => load(kind, campus, { batch, segment }),
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
