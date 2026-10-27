// The shared stats cache (api/cache.ts) on the browser side.
//
// Reading: pages fetch the saved numbers once and put them into the query cache with the
// time they were saved, so they show at once; anything older than the query's staleTime
// is then refreshed from the platform in the background, as before.
//
// Writing: fresh results are queued and sent back in batches every couple of seconds, so
// the next visitor (on any device) starts from them. Only signed-in staff send them; the
// server refuses everyone else.

import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { CodingProfile, PlatformId } from './coding-profiles/types';
import type { PlatformSummary } from './coding-profiles/summaries';

interface CachedRow<T> {
  platform: PlatformId;
  handle: string;
  /** When it was saved, in milliseconds since 1970. */
  at: number;
  summary?: T;
  profile?: T;
}

/** Puts saved data into the query cache unless the browser already has something newer. */
export function seed<T>(client: QueryClient, key: QueryKey, data: T, updatedAt: number) {
  if (!Number.isFinite(updatedAt)) return;
  const current = client.getQueryState(key);
  if (current?.data !== undefined && current.dataUpdatedAt >= updatedAt) return;
  client.setQueryData(key, data, { updatedAt });
}

/** Every saved table summary, put into the query cache under `keyFor(platform, handle)`. */
export async function loadSummaries(
  client: QueryClient,
  keyFor: (platform: PlatformId, handle: string) => QueryKey
): Promise<number> {
  const response = await fetch('/api/cache?kind=summaries');
  if (!response.ok) return 0; // no database, or logged out: start from live data
  const { summaries } = (await response.json()) as { summaries: CachedRow<PlatformSummary>[] };
  for (const row of summaries) {
    if (row.summary) seed(client, keyFor(row.platform, row.handle), row.summary, row.at);
  }
  return summaries.length;
}

/** One student's saved profile pages, put into the query cache under `keyFor(...)`. */
export async function loadProfiles(
  client: QueryClient,
  slug: string,
  keyFor: (platform: PlatformId, handle: string) => QueryKey
): Promise<number> {
  const response = await fetch(`/api/cache?kind=profiles&s=${encodeURIComponent(slug)}`);
  if (!response.ok) return 0;
  const { profiles } = (await response.json()) as { profiles: CachedRow<CodingProfile>[] };
  for (const row of profiles) {
    if (row.profile) seed(client, keyFor(row.platform, row.handle), row.profile, row.at);
  }
  return profiles.length;
}

// --- Saving -------------------------------------------------------------------------------

const FLUSH_MS = 2000;
// Only signed-in staff save (the server refuses everyone else), so public visitors send nothing.
let saving = false;

/** Turned on by staff pages; public profile pages leave it off. */
export function setSaving(enabled: boolean) {
  saving = enabled;
}

const queued = {
  summaries: new Map<string, { platform: PlatformId; handle: string; summary: PlatformSummary }>(),
  profiles: new Map<string, { platform: PlatformId; handle: string; profile: CodingProfile }>(),
};
let timer: ReturnType<typeof setTimeout> | undefined;

export function saveSummary(platform: PlatformId, handle: string, summary: PlatformSummary) {
  if (!saving) return;
  queued.summaries.set(`${platform}:${handle}`, { platform, handle, summary });
  schedule();
}

export function saveProfile(platform: PlatformId, handle: string, profile: CodingProfile) {
  if (!saving) return;
  queued.profiles.set(`${platform}:${handle}`, { platform, handle, profile });
  schedule();
}

function schedule() {
  timer ??= setTimeout(flush, FLUSH_MS);
}

async function flush() {
  timer = undefined;
  const summaries = [...queued.summaries.values()];
  const profiles = [...queued.profiles.values()];
  queued.summaries.clear();
  queued.profiles.clear();

  const post = (body: object) =>
    fetch('/api/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined); // a missed save only means the next visit refreshes it again

  // Summaries are tiny; profiles can be tens of kilobytes each.
  for (let start = 0; start < summaries.length; start += 300) {
    await post({ summaries: summaries.slice(start, start + 300) });
  }
  for (let start = 0; start < profiles.length; start += 4) {
    await post({ profiles: profiles.slice(start, start + 4) });
  }
}
