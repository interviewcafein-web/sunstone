// Copies PRIME coding domain delivery from the delivery tracker (a separate Supabase Postgres)
// into Vertex: classes taught (date, campus, batch, section, trainer, topic, hours, status),
// allocated hours per campus/batch/section, and each curriculum's topics in order. Read-only
// on the tracker; replaces the previous copy in one transaction.
//
//   npm run db:sync-delivery        (DATABASE_URL and DELIVERY_DATABASE_URL from .env.local)
//
// DELIVERY_DATABASE_URL is the tracker's Postgres connection string (session pooler), kept out
// of the code; SUPABASE_URL is accepted as a fallback name.

import { neon } from '@neondatabase/serverless';
import pg from 'pg';

import { batchInserts } from './_insert';

const target = process.env.DATABASE_URL;
const source = process.env.DELIVERY_DATABASE_URL ?? process.env.SUPABASE_URL;
if (!target) throw new Error('DATABASE_URL is not set (add it to .env.local).');
if (!source?.startsWith('postgres')) {
  throw new Error('DELIVERY_DATABASE_URL (the delivery tracker connection string) is not set.');
}

/** The tracker's program codes as Vertex names them. */
const PROGRAM: Record<string, string> = { 'BTECH-CS': 'B.Tech', BCA: 'BCA', MCA: 'MCA' };
/**
 * Batches the tracker files under another campus or program than the LMS: Rathinam's B.Tech
 * batches are under RGIB in the tracker, but their students are RITB's BE in the LMS.
 */
const MOVED: Record<string, { campus: string; program: string }> = {
  'RGIB:B.Tech': { campus: 'RITB', program: 'BE' },
};
const yearOf = (name: string | null) => {
  const match = name?.match(/(20\d\d)/);
  return match ? Number(match[1]) : null;
};
const yearsOf = (name: string) => [...name.matchAll(/20\d\d/g)].map((match) => Number(match[0]));

const tracker = new pg.Client({ connectionString: source, ssl: { rejectUnauthorized: false } });
await tracker.connect();
await tracker.query('begin read only');
await tracker.query("set statement_timeout = '60s'");

const { rows: classes } = await tracker.query(`
  select r.id, r.class_date::text as class_date, trim(c.code) as campus_code, p.code as program,
         b.name as batch, r.section, pr.full_name as trainer, cu.name as curriculum,
         t.name as topic, t.order_index as topic_order, st.name as subtopic,
         r.duration_minutes as minutes, r.total_present as present,
         r.student_count_snapshot as total, r.verification_status::text as status
  from class_records r
  join campuses c on c.id = r.campus_id
  join programs p on p.id = r.program_id
  left join batches b on b.id = r.batch_id
  left join profiles pr on pr.id = r.trainer_id
  left join curriculum_topics t on t.id = r.topic_id
  left join curriculum_modules m on m.id = t.module_id
  left join curriculums cu on cu.id = m.curriculum_id
  left join curriculum_subtopics st on st.id = r.subtopic_id`);

const { rows: targets } = await tracker.query(`
  select trim(c.code) as campus_code, p.code as program, b.name as batch, e.section,
         e.student_count as students, e.planned_hours, e.agreed_hours
  from enrollment_metrics e
  join campuses c on c.id = e.campus_id
  join programs p on p.id = e.program_id
  left join batches b on b.id = e.batch_id`);

const { rows: topics } = await tracker.query(`
  select cu.name as curriculum, p.code as program, t.name as topic, t.order_index as topic_order,
         (select count(*) from curriculum_subtopics s where s.topic_id = t.id)::int as subtopics
  from curriculum_topics t
  join curriculum_modules m on m.id = t.module_id
  join curriculums cu on cu.id = m.curriculum_id
  join programs p on p.id = cu.program_id`);

await tracker.query('rollback');
await tracker.end();

const program = (code: string) => PROGRAM[code] ?? code;
/** Vertex's campus and program for a tracker row. */
const place = (row: { campus_code: string; program: string }) =>
  MOVED[`${row.campus_code}:${program(row.program)}`] ?? {
    campus: row.campus_code,
    program: program(row.program),
  };
// A moved batch keeps its curriculum, so its topics are listed under the new program too.
const topicRows = topics.flatMap((row) => [
  { ...row, program: program(row.program) },
  ...Object.entries(MOVED)
    .filter(([key]) => key.endsWith(`:${program(row.program)}`))
    .map(([, moved]) => ({ ...row, program: moved.program })),
]);
const sql = neon(target);
await sql.transaction([
  sql`delete from dlv_classes`,
  sql`delete from dlv_targets`,
  sql`delete from dlv_topics`,
  ...batchInserts(
    sql,
    'dlv_classes',
    classes.map((row) => ({
      id: row.id,
      class_date: row.class_date,
      campus_code: place(row).campus,
      program: place(row).program,
      batch_year: yearOf(row.batch),
      section: row.section,
      trainer: row.trainer,
      curriculum: row.curriculum,
      topic: row.topic?.trim() ?? null,
      topic_order: row.topic_order,
      subtopic: row.subtopic?.trim() ?? null,
      minutes: row.minutes,
      present: row.present,
      total: row.total,
      status: row.status,
    }))
  ),
  ...batchInserts(
    sql,
    'dlv_targets',
    targets.map((row) => ({
      campus_code: place(row).campus,
      program: place(row).program,
      batch_year: yearOf(row.batch),
      section: row.section,
      students: row.students,
      planned_hours: row.planned_hours,
      allocated_hours: row.agreed_hours,
    }))
  ),
  ...batchInserts(
    sql,
    'dlv_topics',
    topicRows.map((row) => ({
      curriculum: row.curriculum,
      program: row.program,
      batch_years: `{${yearsOf(row.curriculum).join(',')}}`,
      topic: row.topic.trim(),
      topic_order: row.topic_order,
      subtopics: row.subtopics,
    }))
  ),
  sql`insert into sync_state (name, ran_at, detail) values ('delivery', now(), ${JSON.stringify({ classes: classes.length })}::jsonb)
      on conflict (name) do update set ran_at = now(), detail = excluded.detail`,
]);
console.log(
  `Delivery: ${classes.length} classes, ${targets.length} allocations, ${topics.length} topics.`
);
