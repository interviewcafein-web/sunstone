import { useEffect } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { fetchCodingProfile } from '@/lib/coding-profiles/adapters';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import { ProfileError, type Handles, type PlatformId } from '@/lib/coding-profiles/types';
import { loadProfiles, saveProfile, setSaving } from '@/lib/statsCache';

const queryKeyFor = (platform: PlatformId, handle: string) => ['coding-profile', platform, handle];

/**
 * One query per platform that has a handle, so each card loads and fails on its own.
 *
 * For a student's page (`student` = their username) the saved profile from the database
 * shows at once and is refreshed from the platform in the background; staff (`save`) send
 * the fresh result back so the next visit is instant too.
 */
export function useCodingProfiles(
  handles: Handles,
  { student, save = false }: { student?: string; save?: boolean } = {}
) {
  useEffect(() => setSaving(save), [save]);
  const active = PLATFORMS.filter((platform) => handles[platform.id]);

  const saved = useQuery({
    queryKey: ['saved-profiles', student],
    queryFn: ({ client }) => loadProfiles(client, student!, queryKeyFor),
    enabled: Boolean(student),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const ready = !student || !saved.isPending;

  const results = useQueries({
    queries: active.map((platform) => {
      const username = handles[platform.id]!;
      return {
        queryKey: queryKeyFor(platform.id, username),
        queryFn: async () => {
          const profile = await fetchCodingProfile(platform.id, username);
          saveProfile(platform.id, username, profile);
          return profile;
        },
        enabled: ready,
        // A wrong handle or a missing relay will not fix itself on retry.
        retry: (failureCount: number, error: Error) =>
          failureCount < 1 && error instanceof ProfileError && error.kind === 'network',
      };
    }),
  });

  return active.map((platform, index) => ({ platform, query: results[index] }));
}
