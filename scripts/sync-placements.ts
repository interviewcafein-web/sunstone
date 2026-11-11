// Copies our students' job offers (selections) from the LMS into placements, replacing the
// previous copy: full-time jobs and internships, each marked. The rules follow the placement
// team's own report: jobs opened to the student's program and batch, live jobs only (not the test ones), and every
// selection except those entered by mistake or turned down over a JD/CTC mismatch. Offers
// withdrawn later (revoked, terminated, resigned) still count, marked as withdrawn.
//
//   REDASH_KEY=... npm run db:sync-placements      (DATABASE_URL from .env.local)
//   REDASH_KEY=... npm run db:sync-placements -- --dry

import { neon } from '@neondatabase/serverless';

import { redash } from './_redash';

const DRY_RUN = process.argv.includes('--dry');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

const ids = (await sql`select lms_user_id from students where on_platform`).map((row) =>
  Number(row.lms_user_id)
);
if (!ids.length) throw new Error('No students in the database yet: run npm run db:import first.');

// Test jobs and the test account that posts them, left out of the placement team's report too.
const TEST_JOBS = '3430, 6548, 2358';
const TEST_ACCOUNT = 990;
const NOT_COUNTED = [
  'HR changed the result/Uploaded by mistake',
  'Uploaded by mistake',
  'JD/CTC Discrepancy',
];

interface Offer {
  user_id: number;
  opportunity_id: number;
  company: string | null;
  designation: string | null;
  full_time: number | string;
  role_type: string | null;
  category: string | null;
  fixed_lpa: number | null;
  variable_lpa: number | null;
  total_lpa: number | null;
  stipend: number | null;
  months: number | null;
  selected_on: string | null;
  joining_status: number | null;
  joining_on: string | null;
  status: string;
  reason: string | null;
  crc: string | null;
}

const offers: Offer[] = [];
// A few thousand ids per query keeps the SQL a sensible size.
for (let start = 0; start < ids.length; start += 3000) {
  const chunk = ids.slice(start, start + 3000);
  offers.push(
    ...(await redash<Offer>(`
      select pol.user_id, pol.opportunity_id,
        trim(min(co.name)) company,
        max(o.type_of_role = 'full-time' or o.is_fulltime = '1') full_time, min(o.type_of_role) role_type, trim(min(o.designation)) designation, min(o.category) category,
        round(min(case when coalesce(pol.fixed_salary, 0) = 0 then o.fixed_ctc else pol.fixed_salary end) / 100000, 2) fixed_lpa,
        round(min(pol.variable_pay) / 100000, 2) variable_lpa,
        round(min(case when coalesce(pol.fixed_salary, 0) = 0 then o.fixed_ctc
                       else pol.fixed_salary + coalesce(pol.variable_pay, 0) end) / 100000, 2) total_lpa,
        min(nullif(pol.stipend, 0)) stipend, min(nullif(pol.tenure, 0)) months,
        date_format(min(pol.selection_date), '%Y-%m-%d') selected_on,
        min(pol.joining_status) joining_status,
        date_format(min(pol.joining_date), '%Y-%m-%d') joining_on,
        min(pol.status) status, min(pol.reason) reason,
        (select trim(min(pu.name)) from tpo_opportunity t join panel_users pu on pu.id = t.tpo_id
          where t.opportunity_id = pol.opportunity_id) crc
      from placed_offer_letters pol
      join users u on u.id = pol.user_id
      join opportunity o on o.id = pol.opportunity_id
      left join company co on co.id = o.company_id
      where pol.user_id in (${chunk.join(',')})
        and o.status not in ('-1', '0', '1')
        and o.id not in (${TEST_JOBS})
        and coalesce(o.created_by, 0) <> ${TEST_ACCOUNT} and coalesce(o.launched_by, 0) <> ${TEST_ACCOUNT}
        and exists (
          select 1 from opportunity_program_mapping pm
          join campus_program_live_map lm on lm.id = pm.cplm_id
          join program_campus_batch_mapping bm on bm.id = lm.pcbm_id
          where pm.opportunity_id = o.id and lm.batch = u.admission_year and lm.program = u.program
            and bm.type = 'box')
        and (pol.status = '1'
             or (pol.status = '0' and coalesce(pol.reason, '') not in (${NOT_COUNTED.map((r) => `'${r}'`).join(', ')})))
      group by pol.user_id, pol.opportunity_id`))
  );
}

const rows = offers.map((offer) => ({
  user_id: Number(offer.user_id),
  opportunity_id: Number(offer.opportunity_id),
  company: offer.company || null,
  designation: offer.designation || null,
  full_time: Number(offer.full_time) === 1,
  role_type: offer.role_type?.trim() || null,
  category: offer.category?.trim() || null,
  fixed_lpa: offer.fixed_lpa == null ? null : Number(offer.fixed_lpa),
  variable_lpa: offer.variable_lpa == null ? null : Number(offer.variable_lpa),
  total_lpa: offer.total_lpa == null ? null : Number(offer.total_lpa),
  stipend: offer.stipend == null ? null : Math.round(Number(offer.stipend)) || null,
  months: offer.months == null ? null : Math.round(Number(offer.months)) || null,
  selected_on: offer.selected_on,
  joining_status: offer.joining_status == null ? null : Number(offer.joining_status) || null,
  joining_on: offer.joining_on && offer.joining_on !== '0000-00-00' ? offer.joining_on : null,
  withdrawn: String(offer.status) !== '1',
  withdrawn_reason: String(offer.status) !== '1' ? offer.reason || null : null,
  crc: offer.crc || null,
}));

const students = new Set(rows.map((row) => row.user_id)).size;
console.log(
  `Placements: ${rows.length} offers for ${students} students` +
    ` (${rows.filter((row) => row.full_time).length} full-time,` +
    ` ${rows.filter((row) => !row.full_time).length} internships or training)` +
    ` (${rows.filter((row) => row.withdrawn).length} withdrawn later).`
);
if (DRY_RUN) {
  console.log(rows.slice(0, 5));
  process.exit(0);
}

await sql.transaction([
  sql`delete from placements`,
  sql.query(
    `insert into placements (lms_user_id, opportunity_id, company, designation, full_time, role_type, category, fixed_lpa,
       variable_lpa, total_lpa, stipend, months, selected_on, joining_status, joining_on, withdrawn, withdrawn_reason, crc)
     select x.user_id, x.opportunity_id, x.company, x.designation, x.full_time, x.role_type, x.category, x.fixed_lpa,
       x.variable_lpa, x.total_lpa, x.stipend, x.months, x.selected_on::date, x.joining_status, x.joining_on::date,
       x.withdrawn, x.withdrawn_reason, x.crc
     from jsonb_to_recordset($1::jsonb) as x(user_id int, opportunity_id int, company text,
       designation text, full_time boolean, role_type text, category text, fixed_lpa numeric, variable_lpa numeric, total_lpa numeric,
       stipend int, months int, selected_on text, joining_status int, joining_on text, withdrawn boolean,
       withdrawn_reason text, crc text)`,
    [JSON.stringify(rows)]
  ),
  sql`insert into sync_state (name, ran_at, detail)
      values ('placements', now(), ${JSON.stringify({ offers: rows.length, students })})
      on conflict (name) do update set ran_at = excluded.ran_at, detail = excluded.detail`,
]);
