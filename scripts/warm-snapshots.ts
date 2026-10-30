// Makes the saved answers for the heaviest pages (api/_snapshot.ts) right after the nightly
// sync, so the first visitor of the day does not wait: the campus list, the 360° numbers, and
// every campus page for all batches, each program and each batch.
//
//   npm run db:warm            (DATABASE_URL from .env.local)

import { neon } from '@neondatabase/serverless';

import { EVERYONE, campus, campusKey, campuses, metricsByCampus } from '../api/assessments';
import { dataVersion, remake } from '../api/_snapshot';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

const started = Date.now();
const version = await dataVersion();
await remake('campuses', () => campuses(EVERYONE), version);
await remake('metrics', metricsByCampus, version);

// Each campus with all batches, each program ("B.Tech:") and each batch ("B.Tech:2025"), the
// choices the campus page offers.
const rows = await sql`
  select campus_id, program, admission_year from students
  where on_platform and campus_id is not null and program is not null and admission_year is not null
  group by 1, 2, 3`;
const jobs = new Map<string, { campusId: number; batch: string | null }>();
for (const row of rows) {
  const campusId = Number(row.campus_id);
  for (const batch of [null, `${row.program}:`, `${row.program}:${row.admission_year}`]) {
    jobs.set(campusKey(campusId, batch), { campusId, batch });
  }
}

// A few at a time: enough to be quick without crowding the database.
const queue = [...jobs.entries()];
let failed = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [key, { campusId, batch }] = next;
      try {
        await remake(key, () => campus(campusId, batch), version);
      } catch (error) {
        failed++;
        console.error('Could not make', key, error instanceof Error ? error.message : error);
      }
    }
  })
);
console.log(
  `Saved answers: campus list, 360° numbers and ${jobs.size - failed} of ${jobs.size} campus pages in ${Math.round((Date.now() - started) / 1000)} s.`
);
