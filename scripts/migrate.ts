// Applies the SQL files in db/migrations/ that have not run yet, in name order, each in its
// own transaction. Run with `npm run db:migrate` (reads DATABASE_URL from .env.local).

import { readdir, readFile } from 'node:fs/promises';
import { Pool } from '@neondatabase/serverless';

const DIR = new URL('../db/migrations/', import.meta.url);

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');

const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set(
    (await client.query<{ name: string }>('select name from schema_migrations')).rows.map(
      (row) => row.name
    )
  );

  const files = (await readdir(DIR)).filter((file) => file.endsWith('.sql')).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(new URL(file, DIR), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw new Error(`${file} failed: ${error instanceof Error ? error.message : error}`);
    }
    console.log(`applied ${file}`);
    applied++;
  }
  console.log(applied ? `${applied} migration(s) applied.` : 'Database is up to date.');
} finally {
  client.release();
  await pool.end();
}
