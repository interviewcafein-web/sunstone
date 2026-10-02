import { useQueries } from '@tanstack/react-query';

import { fetchCodingProfile } from '@/lib/coding-profiles/adapters';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import { ProfileError, type Handles } from '@/lib/coding-profiles/types';

/** One query per platform that has a handle, so each card loads and fails on its own. */
export function useCodingProfiles(handles: Handles) {
  const active = PLATFORMS.filter((platform) => handles[platform.id]);

  const results = useQueries({
    queries: active.map((platform) => {
      const username = handles[platform.id]!;
      return {
        queryKey: ['coding-profile', platform.id, username],
        queryFn: () => fetchCodingProfile(platform.id, username),
        // A wrong handle or a missing relay will not fix itself on retry.
        retry: (failureCount: number, error: Error) =>
          failureCount < 1 && error instanceof ProfileError && error.kind === 'network',
      };
    }),
  });

  return active.map((platform, index) => ({ platform, query: results[index] }));
}
