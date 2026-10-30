// Copies class attendance for our students from the Sunstone LMS (through Redash), summarised:
// every class session (date, subject, section, instructor, marked/present), each student's
// attendance per subject, and per week. Replaces the previous copy in one transaction.
//
//   REDASH_KEY=... npm run db:sync-attendance       (DATABASE_URL from .env.local)
//   ATTENDANCE_FROM=2026-07-01 overrides the start of the term.

import { neon } from '@neondatabase/serverless';

import { batchInserts } from './_insert';
import { personName, subjectName } from './_names';
import { redash } from './_redash';

const FROM = process.env.ATTENDANCE_FROM ?? '2026-07-01';
if (!/^\d{4}-\d{2}-\d{2}$/.test(FROM)) throw new Error('ATTENDANCE_FROM must be YYYY-MM-DD');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

const ids = (await sql`select lms_user_id from students where on_platform`).map((row) =>
  Number(row.lms_user_id)
);
if (!ids.length) throw new Error('No students in the database yet: run npm run db:import first.');
const idList = ids.join(',');

// Classes (not exams or events) that took attendance, from the term start to today. A
// session's subject is linked on the time table or its subgroup, or else named in its title.
const BASE = `
  from time_table tt
  join time_table_student_attendance_mapping ttsm
    on ttsm.time_table_id = tt.id and ttsm.status = '1' and ttsm.student_id in (${idList})
  left join subgroup sub on sub.id = tt.subgroup_id
  left join course co on co.id = coalesce(tt.subject_id, sub.subject_id)
  where tt.status = '1' and tt.event_type = 'class'
    and tt.lecture_date >= '${FROM}' and tt.lecture_date <= curdate()`;
const COURSE = 'coalesce(tt.subject_id, sub.subject_id)';
// Most sessions name their subject only in the event title.
const SUBJECT =
  "coalesce(nullif(trim(co.course_name), ''), nullif(trim(tt.event_title), ''), 'Other classes')";

console.log(`Reading class sessions since ${FROM}…`);
const sessions = await redash<{
  id: number;
  lecture_date: string;
  start_time: string | null;
  section_id: number | null;
  course_id: number | null;
  subject: string | null;
  faculty_id: number | null;
  faculty: string | null;
  marked: number;
  present: number;
  campus_id: number | null;
  minutes: number | null;
  first_student: number | null;
}>(`
  select s.*, trim(pu.name) faculty
  from (
    select tt.id, tt.lecture_date, tt.lecture_start_time start_time, tt.section_id,
           ${COURSE} course_id, ${SUBJECT} subject, tt.professor_id faculty_id,
           count(*) marked, sum(ttsm.is_present = '1') present,
           time_to_sec(timediff(tt.lecture_end_time, tt.lecture_start_time)) div 60 minutes,
           min(ttsm.student_id) first_student,
           (select u.campus_id from users u where u.id = min(ttsm.student_id)) campus_id
    ${BASE}
    group by tt.id
  ) s
  left join panel_users pu on pu.id = s.faculty_id`);

console.log('Reading attendance per student and subject…');
const perSubject = await redash<{
  student_id: number;
  subject: string;
  course_id: number | null;
  sessions: number;
  present: number;
  last_date: string | null;
}>(`
  select ttsm.student_id, ${SUBJECT} subject, max(${COURSE}) course_id, count(*) sessions,
         sum(ttsm.is_present = '1') present, max(tt.lecture_date) last_date
  ${BASE}
  group by ttsm.student_id, ${SUBJECT}`);

console.log('Reading attendance per student and week…');
const perWeek = await redash<{
  student_id: number;
  week: string;
  sessions: number;
  present: number;
}>(`
  select ttsm.student_id, date_sub(tt.lecture_date, interval weekday(tt.lecture_date) day) week,
         count(*) sessions, sum(ttsm.is_present = '1') present
  ${BASE}
  group by ttsm.student_id, week`);

const day = (value: string | null) => (value ? String(value).slice(0, 10) : null);

// Spelling variants of one subject become one row per student.
const merged = new Map<
  string,
  {
    lms_user_id: number;
    subject: string;
    course_id: number | null;
    sessions: number;
    present: number;
    last_date: string | null;
  }
>();
for (const row of perSubject) {
  const subject = subjectName(String(row.subject)).slice(0, 200);
  const key = `${row.student_id}|${subject.toLowerCase()}`;
  const entry = merged.get(key) ?? {
    lms_user_id: row.student_id,
    subject,
    course_id: row.course_id,
    sessions: 0,
    present: 0,
    last_date: null as string | null,
  };
  entry.sessions += Number(row.sessions);
  entry.present += Number(row.present);
  const last = day(row.last_date);
  if (last && (!entry.last_date || last > entry.last_date)) entry.last_date = last;
  merged.set(key, entry);
}
const mergedSubjects = [...merged.values()];

const inserts = <T extends Record<string, unknown>>(table: string, rows: T[]) =>
  batchInserts(sql, table, rows);

await sql.transaction([
  sql`delete from att_sessions`,
  sql`delete from att_student_subject`,
  sql`delete from att_student_week`,
  ...inserts(
    'att_sessions',
    sessions.map((session) => ({
      id: session.id,
      lecture_date: day(session.lecture_date),
      start_time: session.start_time ? String(session.start_time).slice(0, 5) : null,
      section_id: session.section_id,
      course_id: session.course_id,
      subject: session.subject ? subjectName(session.subject) : null,
      faculty_id: session.faculty_id,
      faculty: session.faculty ? personName(session.faculty) : null,
      campus_id: session.campus_id,
      minutes: session.minutes == null ? null : Number(session.minutes),
      first_student: session.first_student,
      marked: Number(session.marked),
      present: Number(session.present),
    }))
  ),
  ...inserts('att_student_subject', mergedSubjects),
  ...inserts(
    'att_student_week',
    perWeek.map((row) => ({
      lms_user_id: row.student_id,
      week: day(row.week),
      sessions: Number(row.sessions),
      present: Number(row.present),
    }))
  ),
  sql`insert into sync_state (name, ran_at, detail)
      values ('attendance', now(), ${JSON.stringify({
        from: FROM,
        sessions: sessions.length,
        studentSubjects: mergedSubjects.length,
        studentWeeks: perWeek.length,
      })})
      on conflict (name) do update set ran_at = excluded.ran_at, detail = excluded.detail`,
]);

console.log('Saved:', {
  from: FROM,
  sessions: sessions.length,
  studentSubjects: mergedSubjects.length,
  studentWeeks: perWeek.length,
});
