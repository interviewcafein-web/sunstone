import { createFileRoute } from '@tanstack/react-router';

import ProfilesPage from '@/pages/ProfilesPage';
import { PLATFORM_IDS } from '@/lib/coding-profiles/platforms';
import type { Handles } from '@/lib/coding-profiles/types';

export type ProfileSearch = Handles & { name?: string };

// Handles live in the URL (/profile?leetcode=lee215&codeforces=tourist) so a profile can
// be shared as a link: there is no backend to store them.
export const Route = createFileRoute('/profile')({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => {
    const result: ProfileSearch = {};
    for (const id of PLATFORM_IDS) {
      const value = search[id];
      if (typeof value === 'string' || typeof value === 'number') {
        const handle = String(value).trim();
        if (handle) result[id] = handle;
      }
    }
    if (typeof search.name === 'string' && search.name.trim()) result.name = search.name.trim();
    return result;
  },
  component: ProfilesPage,
});
