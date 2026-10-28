// Copies each of our campuses' short code and logo from the Sunstone LMS (through Redash).
// Only those two columns are read: the LMS campus table also holds integration secrets.
//
//   REDASH_KEY=... npm run db:sync-campuses        (DATABASE_URL from .env.local)

import { neon } from '@neondatabase/serverless';

import { redash } from './_redash';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

const ids = (
  await sql`select distinct campus_id from students where on_platform and campus_id is not null`
).map((row) => Number(row.campus_id));
if (!ids.length) throw new Error('No students in the database yet: run npm run db:import first.');

const rows = await redash<{ id: number; code: string | null; logo: string | null }>(
  `select id, campus_name as code, logo from campus where id in (${ids.join(',')})`
);
const https = (value: string | null) => (value && /^https:\/\/\S+$/.test(value) ? value : null);

await sql.query(
  `insert into campuses (id, code, logo_url, synced_at)
   select x.id, x.code, x.logo_url, now()
   from jsonb_to_recordset($1::jsonb) as x(id int, code text, logo_url text)
   on conflict (id) do update set code = excluded.code, logo_url = excluded.logo_url,
     synced_at = excluded.synced_at`,
  [JSON.stringify(rows.map((row) => ({ id: row.id, code: row.code, logo_url: https(row.logo) })))]
);
console.log(
  `Campuses: ${rows.length} saved, ${rows.filter((row) => https(row.logo)).length} with a logo.`
);
