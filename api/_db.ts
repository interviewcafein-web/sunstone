// The Neon Postgres database, over Neon's HTTP driver: one HTTPS request per query, no
// connection pool to keep, so it works the same in Edge Functions, Node functions and the
// nightly sync script. DATABASE_URL lives in .env.local and in Vercel's environment
// variables, never in the code (the repo is public).

import { neon, type NeonQueryFunction, type NeonQueryPromise } from '@neondatabase/serverless';

import { requestApp } from './_app';

const clients = new Map<string, NeonQueryFunction<false, false>>();

/**
 * Tagged-template SQL: sql`select * from students where id = ${id}` (values are parameters).
 * The database is the site's (api/_app.ts): Converge's for a converge.sunstone.in request.
 */
export function db(): NeonQueryFunction<false, false> {
  // A Converge request uses Converge's database; scripts always use DATABASE_URL (the
  // Converge job points it at Converge's).
  const name = requestApp() === 'converge' ? 'CONVERGE_DATABASE_URL' : 'DATABASE_URL';
  const url = process.env[name];
  if (!url) throw new Error(`${name} is not configured.`);
  let client = clients.get(url);
  if (!client) {
    client = neon(url);
    clients.set(url, client);
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
