// Copies the LMS's opportunity cohorts our students are in (Cohort A - Pinnacle, B - Zenith,
// C, D - Functional, E - Super-100) into student_cohorts, replacing the previous copy.
//
//   REDASH_KEY=... npm run db:sync-cohorts      (DATABASE_URL from .env.local)

import { neon } from '@neondatabase/serverless';

import { redash } from './_redash';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

const ids = (await sql`select lms_user_id from students where on_platform`).map((row) =>
  Number(row.lms_user_id)
);
if (!ids.length) throw new Error('No students in the database yet: run npm run db:import first.');

const rows = await redash<{ user_id: number; cohort_id: number; cohort: string; added: string }>(`
  select m.user_id, c.id cohort_id, trim(c.name) cohort, min(m.created) added
  from user_opportunity_cohort_mapping m
  join opportunity_cohorts c on c.id = m.opportunity_cohort_id and c.status = '1'
  where m.status = '1' and m.user_id in (${ids.join(',')})
  group by m.user_id, c.id, c.name`);

await sql.transaction([
  sql`delete from student_cohorts`,
  sql.query(
    `insert into student_cohorts (lms_user_id, cohort_id, cohort, added_at)
     select x.user_id, x.cohort_id, x.cohort, x.added::timestamptz
     from jsonb_to_recordset($1::jsonb) as x(user_id int, cohort_id int, cohort text, added text)`,
    [JSON.stringify(rows)]
  ),
]);

const byCohort = new Map<string, number>();
for (const row of rows) byCohort.set(row.cohort, (byCohort.get(row.cohort) ?? 0) + 1);
console.log(`Cohorts: ${rows.length} memberships for ${ids.length} students.`);
for (const [cohort, count] of [...byCohort].sort()) console.log(`  ${cohort}: ${count}`);
