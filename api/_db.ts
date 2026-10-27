// The Neon Postgres database, over Neon's HTTP driver: one HTTPS request per query, no
// connection pool to keep, so it works the same in Edge Functions, Node functions and the
// nightly sync script. DATABASE_URL lives in .env.local and in Vercel's environment
// variables, never in the code (the repo is public).

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

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
