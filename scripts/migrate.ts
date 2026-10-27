// Applies the SQL files in db/migrations/ that have not run yet, in name order, each in its
// own transaction. Run with `npm run db:migrate` (reads DATABASE_URL from .env.local).
//
// Uses Neon's HTTP driver (one statement per request, so each file is split at the `;` that
// ends a line). Keep migration files to plain statements: no `;` at the end of a line
// inside a statement (e.g. function bodies).

import { readdir, readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const DIR = new URL('../db/migrations/', import.meta.url);

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

/** Statements in a migration file, without comments. */
const statements = (text: string) =>
  text
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);

await sql`create table if not exists schema_migrations (
  name text primary key, applied_at timestamptz not null default now())`;
const done = new Set(
  (await sql`select name from schema_migrations`).map((row) => String(row.name))
);

const files = (await readdir(DIR)).filter((file) => file.endsWith('.sql')).sort();
let applied = 0;
for (const file of files) {
  if (done.has(file)) continue;
  const queries = statements(await readFile(new URL(file, DIR), 'utf8'));
  try {
    await sql.transaction([
      ...queries.map((query) => sql.query(query)),
      sql`insert into schema_migrations (name) values (${file})`,
    ]);
  } catch (error) {
    throw new Error(`${file} failed: ${error instanceof Error ? error.message : error}`);
  }
  console.log(`applied ${file} (${queries.length} statements)`);
  applied++;
}
console.log(applied ? `${applied} migration(s) applied.` : 'Database is up to date.');
