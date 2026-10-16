// Zones group students by how much they have practised, so a campus head can see at a
// glance who needs attention. One count decides the zone: LeetCode solved if the student
// has a usable LeetCode, otherwise the next platform in ZONE_BASIS. GitHub never counts,
// since it measures contributions rather than problems solved.

import type { PlatformId } from '../coding-profiles/types';

export type ZoneId = 'green' | 'yellow' | 'orange' | 'red' | 'none';

export interface Zone {
  id: ZoneId;
  label: string;
  /** Lowest count in this zone (inclusive); undefined for "Not linked". */
  min?: number;
  rule: string;
  advice: string;
  color: string;
  /** Light tint for backgrounds. */
  tint: string;
}

export const ZONES: Zone[] = [
  {
    id: 'green',
    label: 'Green zone',
    min: 100,
    rule: '100+ solved',
    advice: 'Strong practice. Push them to contests and harder problems.',
    color: '#16a34a',
    tint: '#dcfce7',
  },
  {
    id: 'yellow',
    label: 'Yellow zone',
    min: 50,
    rule: '50–99 solved',
    advice: 'On track. Next milestone: 100 problems.',
    color: '#ca8a04',
    tint: '#fef9c3',
  },
  {
    id: 'orange',
    label: 'Orange zone',
    min: 25,
    rule: '25–49 solved',
    advice: 'Needs a push. Set weekly targets and check in regularly.',
    color: '#ea580c',
    tint: '#ffedd5',
  },
  {
    id: 'red',
    label: 'Red zone',
    min: 0,
    rule: 'Under 25 solved',
    advice: 'Focus list. Needs mentoring and a fixed daily practice slot.',
    color: '#dc2626',
    tint: '#fee2e2',
  },
  {
    id: 'none',
    label: 'Not linked',
    rule: 'No usable username',
    advice: 'No usable coding profile. Ask them to fix their entry in the form.',
    color: '#64748b',
    tint: '#f1f5f9',
  },
];

/** Which platform's solved count decides the zone, in order of preference. */
export const ZONE_BASIS: PlatformId[] = [
  'leetcode',
  'geeksforgeeks',
  'codeforces',
  'codechef',
  'hackerrank',
];

export const zoneById = (id: ZoneId) => ZONES.find((zone) => zone.id === id)!;

export interface ZoneResult {
  zone: ZoneId;
  /** The platform whose count decided the zone. */
  basis?: PlatformId;
  count?: number;
}

/**
 * `solved` holds each platform's solved count where it loaded; a platform that is not
 * linked, not found or has an unusable entry is simply absent.
 */
export function zoneOf(solved: Partial<Record<PlatformId, number>>): ZoneResult {
  const basis = ZONE_BASIS.find((platform) => solved[platform] !== undefined);
  if (!basis) return { zone: 'none' };
  const count = solved[basis]!;
  const zone = ZONES.find((item) => item.min !== undefined && count >= item.min)!;
  return { zone: zone.id, basis, count };
}
