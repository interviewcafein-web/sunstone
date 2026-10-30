// Ready-made answers for the heaviest pages, kept in the database (api_snapshots), so a page
// opens at once instead of waiting for its numbers to be worked out.
//
// A saved answer is served as it is. When it is older than a few minutes, or the data has
// been synced since it was made, it is still served, and a fresh one is made in the
// background for the next request (stale while revalidate). Only a page never made before
// waits for its numbers. scripts/warm-snapshots.ts makes them all after each nightly sync.

import { db } from './_db';

/** Vercel passes Edge Functions a context whose waitUntil lets work finish after the reply. */
export interface WaitUntil {
  waitUntil?: (promise: Promise<unknown>) => void;
}

/**
 * How long an answer counts as fresh. The data only changes at a sync, but tests go live and
 * close by the clock during the day, so answers are remade every quarter of an hour of use.
 */
const FRESH_MS = 15 * 60_000;

/** The data's version: when each sync last ran. A new sync makes every saved answer stale. */
const VERSION = `(select coalesce(string_agg(name || '@' || ran_at::text, ',' order by name), '')
  from sync_state)`;

export async function dataVersion(): Promise<string> {
  const [row] = await db().query(`select ${VERSION} as version`);
  return String(row.version);
}

/** Makes and saves the answer for `key`. */
export async function remake<T>(key: string, make: () => Promise<T>, version?: string): Promise<T> {
  const [body, current] = await Promise.all([make(), version ?? dataVersion()]);
  await db().query(
    `insert into api_snapshots (key, body, version, made_at, refreshing_at)
     values ($1, $2::jsonb, $3, now(), null)
     on conflict (key) do update set body = excluded.body, version = excluded.version,
       made_at = now(), refreshing_at = null`,
    [key, JSON.stringify(body), current]
  );
  return body;
}

/** One request at a time remakes an answer; the others keep serving the saved one. */
async function claim(key: string): Promise<boolean> {
  const rows = await db().query(
    `update api_snapshots set refreshing_at = now()
     where key = $1 and (refreshing_at is null or refreshing_at < now() - interval '2 minutes')
     returning 1`,
    [key]
  );
  return rows.length > 0;
}

/** The saved answer for `key` (remade in the background when stale), or a new one. */
export async function snapshot<T>(
  key: string,
  make: () => Promise<T>,
  context?: WaitUntil
): Promise<T> {
  const [row] = await db().query(
    `select s.body, s.version, extract(epoch from now() - s.made_at) * 1000 as age_ms,
            ${VERSION} as current
     from (select 1) one left join api_snapshots s on s.key = $1`,
    [key]
  );
  const current = String(row.current);
  if (row.body == null) return remake(key, make, current);
  if (row.version !== current || Number(row.age_ms) > FRESH_MS) {
    const job = claim(key)
      .then((mine) => (mine ? remake(key, make, current) : undefined))
      .catch((error) => console.error('[snapshot]', key, error));
    // Off Vercel (local dev) there is no waitUntil; the promise simply runs on.
    context?.waitUntil?.(job);
  }
  return row.body as T;
}
