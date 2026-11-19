// Copies our students' job offers (selections) from the LMS into placements, replacing the
// previous copy: full-time jobs and internships, each marked. The rules follow the placement
// team's own report: jobs opened to the student's program and batch, live jobs only (not the
// test ones), and every
// selection except those entered by mistake or turned down over a JD/CTC mismatch. Offers
// withdrawn later (revoked, terminated, resigned) still count, marked as withdrawn. Also the
// whole school at our campuses (placement_population), PRIME opt-in or not, for comparison.
//
//   REDASH_KEY=... npm run db:sync-placements      (DATABASE_URL from .env.local)
//   REDASH_KEY=... npm run db:sync-placements -- --dry

import { neon } from '@neondatabase/serverless';

import { redash } from './_redash';
import { PROGRAM_NAMES, SCHOOL } from './_school';

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

/** The offers the placement team counts (pol = the offer, o = its job, u = the student). */
const COUNTED = `o.status not in ('-1', '0', '1')
  and o.id not in (${TEST_JOBS})
  and coalesce(o.created_by, 0) <> ${TEST_ACCOUNT} and coalesce(o.launched_by, 0) <> ${TEST_ACCOUNT}
  and exists (
    select 1 from opportunity_program_mapping pm
    join campus_program_live_map lm on lm.id = pm.cplm_id
    join program_campus_batch_mapping bm on bm.id = lm.pcbm_id
    where pm.opportunity_id = o.id and lm.batch = u.admission_year and lm.program = u.program
      and bm.type = 'box')
  and (pol.status = '1'
       or (pol.status = '0' and coalesce(pol.reason, '') not in (${NOT_COUNTED.map((r) => `'${r}'`).join(', ')})))`;

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
        and ${COUNTED}
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

// How far each student got with opportunities: eligible, applied, shortlisted in a round, and
// reached an interview round (personal / HR / face-to-face / technical interview, or a group
// discussion). The LMS keeps one row per student and opportunity (eligibility and
// application) and one per student and selection round.
const INTERVIEW_ROUND = `interview|(^|[^a-z])(pi|hr|gd)([^a-z]|$)|face|technical|group discussion`;
const pipeline = ids.length
  ? await redash<{
      user_id: number;
      eligible: number;
      applied: number;
      last_applied: string | null;
      shortlisted: number | null;
      interviews: number | null;
    }>(`
      select e.user_id,
        count(distinct case when e.is_eligible = 1 then e.opportunity_id end) eligible,
        count(distinct case when e.is_applied = 1 then e.opportunity_id end) applied,
        date(max(e.opportunity_applied_datetime)) last_applied,
        r.shortlisted, r.interviews
      from opportunity_user_eligible_map e
      left join (
        select s.user_id,
          count(distinct case when s.is_shortlisted = 1 then s.opportunity_id end) shortlisted,
          count(distinct case when lower(spm.name) regexp '${INTERVIEW_ROUND}'
                then s.opportunity_id end) interviews
        from opportunity_user_shortlisting_map s
        join opportunity_selection_process_map spm on spm.id = s.selection_process_map_id
        where s.user_id in (${ids.join(',')}) and s.status = '1'
        group by s.user_id) r on r.user_id = e.user_id
      where e.user_id in (${ids.join(',')}) and e.status = '1'
      group by e.user_id, r.shortlisted, r.interviews`)
  : [];
const pipelineRows = pipeline.map((row) => ({
  lms_user_id: Number(row.user_id),
  eligible: Number(row.eligible ?? 0),
  applied: Number(row.applied ?? 0),
  shortlisted: Number(row.shortlisted ?? 0),
  interviews: Number(row.interviews ?? 0),
  last_applied: row.last_applied && row.last_applied !== '0000-00-00' ? row.last_applied : null,
}));
console.log(
  `Pipeline: ${pipelineRows.filter((row) => row.eligible).length} eligible for an opportunity,` +
    ` ${pipelineRows.filter((row) => row.applied).length} applied,` +
    ` ${pipelineRows.filter((row) => row.shortlisted).length} shortlisted,` +
    ` ${pipelineRows.filter((row) => row.interviews).length} reached an interview.`
);

// Every student of the school at our campuses and batches, PRIME opt-in or not, with their best
// offer of each kind: to compare placement outcomes of PRIME students with everyone else.
const PRIME_POLICY_ID = 20; // policies.type = 'PRIME_OPT_IN', as in import-students.ts
const scope = await sql`
  select distinct campus_id, admission_year from students
  where on_platform and campus_id is not null and admission_year is not null`;
const campusIds = [...new Set(scope.map((row) => Number(row.campus_id)))];
const years = [...new Set(scope.map((row) => Number(row.admission_year)))];
const population = campusIds.length
  ? await redash<{
      user_id: number;
      campus_id: number;
      program: string;
      admission_year: number;
      opted_in: number;
      ft_offers: number | null;
      ft_best_lpa: number | null;
      intern_offers: number | null;
      intern_best_stipend: number | null;
    }>(`
      select u.id user_id, u.campus_id, pr.short_name program, u.admission_year,
        exists (select 1 from user_policy_mapping m
                where m.user_id = u.id and m.policy_id = ${PRIME_POLICY_ID}) opted_in,
        x.ft_offers, x.ft_best_lpa, x.intern_offers, x.intern_best_stipend
      from users u
      join programs pr on pr.id = u.program
      left join (
        select pol.user_id,
          sum(o.type_of_role = 'full-time' or o.is_fulltime = '1') ft_offers,
          round(max(case when o.type_of_role = 'full-time' or o.is_fulltime = '1' then
            case when coalesce(pol.fixed_salary, 0) = 0 then o.fixed_ctc
                 else pol.fixed_salary + coalesce(pol.variable_pay, 0) end end) / 100000, 2) ft_best_lpa,
          sum(not (o.type_of_role = 'full-time' or o.is_fulltime = '1')) intern_offers,
          max(case when not (o.type_of_role = 'full-time' or o.is_fulltime = '1')
            then nullif(pol.stipend, 0) end) intern_best_stipend
        from placed_offer_letters pol
        join users u on u.id = pol.user_id
        join programs pr on pr.id = u.program
        join opportunity o on o.id = pol.opportunity_id
        where u.campus_id in (${campusIds.join(',')}) and pr.course_type = '${SCHOOL}'
          and ${COUNTED}
        group by pol.user_id) x on x.user_id = u.id
      where u.role = 'student' and u.status = '1' and u.isTestingUser = '0'
        and pr.course_type = '${SCHOOL}' and u.campus_id in (${campusIds.join(',')})
        and u.admission_year in (${years.map((year) => `'${year}'`).join(',')})`)
  : [];
const populationRows = population.map((row) => ({
  lms_user_id: Number(row.user_id),
  campus_id: Number(row.campus_id),
  program: PROGRAM_NAMES[String(row.program).toUpperCase()] ?? String(row.program),
  admission_year: Number(row.admission_year),
  opted_in: Number(row.opted_in) === 1,
  ft_offers: Number(row.ft_offers ?? 0),
  ft_best_lpa: row.ft_best_lpa == null ? null : Number(row.ft_best_lpa),
  intern_offers: Number(row.intern_offers ?? 0),
  intern_best_stipend:
    row.intern_best_stipend == null ? null : Math.round(Number(row.intern_best_stipend)),
}));
console.log(
  `Population: ${populationRows.length} students at our campuses` +
    ` (${populationRows.filter((row) => row.opted_in).length} PRIME opt-in).`
);

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
  sql`delete from placement_population`,
  sql.query(
    `insert into placement_population (lms_user_id, campus_id, program, admission_year, opted_in,
       ft_offers, ft_best_lpa, intern_offers, intern_best_stipend)
     select x.lms_user_id, x.campus_id, x.program, x.admission_year, x.opted_in, x.ft_offers,
       x.ft_best_lpa, x.intern_offers, x.intern_best_stipend
     from jsonb_to_recordset($1::jsonb) as x(lms_user_id int, campus_id int, program text,
       admission_year int, opted_in boolean, ft_offers int, ft_best_lpa numeric,
       intern_offers int, intern_best_stipend int)`,
    [JSON.stringify(populationRows)]
  ),
  sql`delete from placement_pipeline`,
  sql.query(
    `insert into placement_pipeline (lms_user_id, eligible, applied, shortlisted, interviews, last_applied)
     select x.lms_user_id, x.eligible, x.applied, x.shortlisted, x.interviews, x.last_applied::date
     from jsonb_to_recordset($1::jsonb) as x(lms_user_id int, eligible int, applied int,
       shortlisted int, interviews int, last_applied text)`,
    [JSON.stringify(pipelineRows)]
  ),
  sql`insert into sync_state (name, ran_at, detail)
      values ('placements', now(), ${JSON.stringify({ offers: rows.length, students })})
      on conflict (name) do update set ran_at = excluded.ran_at, detail = excluded.detail`,
]);
