// The Neon Postgres database, over Neon's HTTP driver: one HTTPS request per query, no
// connection pool to keep, so it works the same in Edge Functions, Node functions and the
// nightly sync script. DATABASE_URL lives in .env.local and in Vercel's environment
// variables, never in the code (the repo is public).

import { neon, type NeonQueryFunction, type NeonQueryPromise } from '@neondatabase/serverless';

let client: NeonQueryFunction<false, false> | undefined;

/** Tagged-template SQL: sql`select * from students where id = ${id}` (values are parameters). */
export function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not configured.');
    client = neon(url);
  }
  return client;
}

type Rows = Record<string, any>[];

/**
 * Several queries in one HTTPS request, as one read-only transaction: a page waits for one
 * round trip instead of one per query, and keeps few connections open. The queries are only
 * sent here (a query is sent when first awaited), so pass them without awaiting them first.
 * Results come back in the same order.
 */
export function together(queries: NeonQueryPromise<false, false>[]): Promise<Rows[]> {
  if (!queries.length) return Promise.resolve([]);
  return db().transaction(queries, { readOnly: true }) as Promise<Rows[]>;
}
