// Nightly refresh of every student's coding numbers (the students table's one-line summary per
// platform: solved, rating, last active, weekly activity), saved to platform_stats. Runs on
// GitHub Actions after the LMS sync, calling the platforms directly, so staff pages only read
// the saved numbers instead of each browser re-checking every username through Vercel.
//
//   npm run db:sync-coding                 (DATABASE_URL from .env.local)
//   npm run db:sync-coding -- --limit 20   (a few usernames, to try it)
//   npm run db:sync-coding -- --each 3     (a few from each platform)
//
// Each platform is paced as the website paces it (src/lib/coding-profiles/summaries.ts). A
// username a platform reports as not found keeps no new numbers; one that fails for another
// reason (slow, rate limited) keeps its last saved numbers.

import { neon } from '@neondatabase/serverless';

import { fetchDirectly } from '../src/lib/coding-profiles/adapters';
import { PLATFORM_IDS } from '../src/lib/coding-profiles/platforms';
import { fetchPlatformSummary, type PlatformSummary } from '../src/lib/coding-profiles/summaries';
import { ProfileError, type PlatformId } from '../src/lib/coding-profiles/types';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);
fetchDirectly();

const limitAt = process.argv.indexOf('--limit');
const limit = limitAt > 0 ? Number(process.argv[limitAt + 1]) : Infinity;
const eachAt = process.argv.indexOf('--each');
const each = eachAt > 0 ? Number(process.argv[eachAt + 1]) : Infinity;

// Every username on a student still on the platform, once (several students can share one).
const rows = await sql.query(
  `select distinct p.platform, p.handle from students s
   cross join lateral (values ${PLATFORM_IDS.map((id) => `('${id}', s.${id})`).join(', ')}) as p(platform, handle)
   where s.on_platform and p.handle is not null and p.handle <> ''
     and not (p.platform = any(s.invalid_handles))
   order by p.platform, p.handle`
);
const taken = new Map<string, number>();
const targets = rows
  .map((row) => ({ platform: row.platform as PlatformId, handle: String(row.handle) }))
  .filter((target) => {
    taken.set(target.platform, (taken.get(target.platform) ?? 0) + 1);
    return taken.get(target.platform)! <= each;
  })
  .slice(0, limit);

const started = Date.now();
const tally = new Map<string, { saved: number; notFound: number; failed: number }>();
const count = (platform: string, key: 'saved' | 'notFound' | 'failed') => {
  const entry = tally.get(platform) ?? { saved: 0, notFound: 0, failed: 0 };
  entry[key] += 1;
  tally.set(platform, entry);
};

/** Saved in batches, as the website saves them (api/cache.ts). */
let pending: { platform: PlatformId; handle: string; summary: PlatformSummary }[] = [];
async function flush() {
  if (!pending.length) return;
  const batch = pending;
  pending = [];
  await sql.query(
    `insert into platform_stats (platform, handle, summary, summary_at)
     select x.platform, x.handle, x.summary, now()
     from jsonb_to_recordset($1::jsonb) as x(platform text, handle text, summary jsonb)
     on conflict (platform, handle)
     do update set summary = excluded.summary, summary_at = excluded.summary_at`,
    [JSON.stringify(batch)]
  );
}

/** A rate limit or a slow answer clears up; try those twice more, waiting longer each time. */
async function summaryOf(platform: PlatformId, handle: string): Promise<PlatformSummary> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchPlatformSummary(platform, handle);
    } catch (error) {
      const passing =
        error instanceof ProfileError &&
        (error.kind === 'rate_limited' || error.kind === 'network');
      if (!passing || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
    }
  }
}

console.log(`Refreshing ${targets.length} usernames…`);
await Promise.all(
  targets.map(async ({ platform, handle }) => {
    try {
      pending.push({ platform, handle, summary: await summaryOf(platform, handle) });
      count(platform, 'saved');
      if (pending.length >= 100) await flush();
    } catch (error) {
      count(
        platform,
        error instanceof ProfileError && error.kind === 'not_found' ? 'notFound' : 'failed'
      );
    }
  })
);
await flush();

let saved = 0;
for (const [platform, entry] of [...tally].sort()) {
  saved += entry.saved;
  console.log(
    `  ${platform.padEnd(14)} ${entry.saved} saved, ${entry.notFound} not found, ${entry.failed} failed`
  );
}
console.log(
  `Saved ${saved} of ${targets.length} in ${Math.round((Date.now() - started) / 60000)} min.`
);
// Nothing at all saved means something is wrong with the job, not with a few usernames.
if (targets.length && saved === 0) process.exit(1);
