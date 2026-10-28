// Copies internal exam marks for our students from the Sunstone LMS (through Redash): exam
// events (Midterm 1-6, End-term), each subject's exam in them, and marks, with the criteria
// scores of Mock PI / Mock GD exams. Replaces the previous copy in one transaction.
//
//   REDASH_KEY=... npm run db:sync-exams        (DATABASE_URL from .env.local)
//   EXAMS_FROM=2026-01-01 overrides how far back to go.

import { neon } from '@neondatabase/serverless';

import { batchInserts } from './_insert';
import { subjectName } from './_names';
import { redash } from './_redash';

const FROM = process.env.EXAMS_FROM ?? '2026-01-01';
if (!/^\d{4}-\d{2}-\d{2}$/.test(FROM)) throw new Error('EXAMS_FROM must be YYYY-MM-DD');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

const ids = (await sql`select lms_user_id from students where on_platform`).map((row) =>
  Number(row.lms_user_id)
);
if (!ids.length) throw new Error('No students in the database yet: run npm run db:import first.');
const idList = ids.join(',');

// Our students' exam marks (one row per student and exam: the latest submission).
const MARKS = `
  from assignment_submissions s
  where s.submission_type = 'academic_exam' and s.status = '1' and s.student_id in (${idList})
    and s.id in (select max(x.id) from assignment_submissions x
                 where x.submission_type = 'academic_exam' and x.status = '1'
                   and x.student_id in (${idList})
                 group by x.submission_id, x.student_id)`;

console.log(`Reading internal exams since ${FROM}…`);
const exams = await redash<{
  id: number;
  course_id: number | null;
  subject: string | null;
  title: string | null;
  kind: string | null;
  exam_date: string | null;
  max_grades: number | null;
  grades_type: string | null;
  examination_id: number | null;
}>(`
  select e.id, e.course_id, trim(co.course_name) subject, trim(e.title) title, e.exam_type kind,
         e.exam_date, e.max_grades, e.grades_type,
         (select m.academic_examination_id from academic_examination_exam_mapping m
           where m.academic_exam_id = e.id and m.status = '1' order by m.id desc limit 1) examination_id
  from academic_exams e
  left join course co on co.id = e.course_id
  where coalesce(e.exam_date, e.created) >= '${FROM}'
    and e.id in (select distinct s.submission_id ${MARKS})`);
const examIds = exams.map((exam) => exam.id).join(',') || 'null';
const examinationIds =
  [...new Set(exams.map((exam) => exam.examination_id).filter(Boolean))].join(',') || 'null';

const examinations = await redash<{
  id: number;
  title: string | null;
  exam_type: string | null;
  start_date: string | null;
  end_date: string | null;
  semester: number | null;
}>(`
  select id, trim(title) title, exam_type, start_date, end_date, semester
  from academic_examination where id in (${examinationIds})`);

console.log('Reading marks…');
const marks = await redash<{
  sid: number;
  exam_id: number;
  student_id: number;
  obtained: number | null;
  grade_text: string | null;
  graded_at: string | null;
}>(`
  select s.id sid, s.submission_id exam_id, s.student_id, s.obtained_grades obtained,
         s.obtained_grades_text grade_text, s.graded_date graded_at
  ${MARKS} and s.submission_id in (${examIds})`);

const criteria = await redash<{
  sid: number;
  name: string;
  marks: number | null;
  max: number | null;
}>(`
  select cs.assignment_submission_id sid, trim(c.name) name, cs.obtained_marks marks, cs.max_marks max
  from academic_examination_criteria_score cs
  join academic_examination_criteria c on c.id = cs.academic_examination_criteria_id
  join assignment_submissions s on s.id = cs.assignment_submission_id
  where cs.status = '1' and s.submission_type = 'academic_exam' and s.student_id in (${idList})
    and s.submission_id in (${examIds})`);

const criteriaBySubmission = new Map<
  number,
  { name: string; marks: number | null; max: number | null }[]
>();
for (const row of criteria) {
  const list = criteriaBySubmission.get(row.sid) ?? [];
  list.push({
    name: row.name,
    marks: row.marks === null ? null : Number(row.marks),
    max: row.max === null ? null : Number(row.max),
  });
  criteriaBySubmission.set(row.sid, list);
}

const day = (value: string | null) => (value ? String(value).slice(0, 10) : null);
const num = (value: unknown) =>
  value === null || value === undefined || value === '' || Number.isNaN(Number(value))
    ? null
    : Number(value);
const inserts = <T extends Record<string, unknown>>(table: string, rows: T[]) =>
  batchInserts(sql, table, rows);

await sql.transaction([
  sql`delete from exm_examinations`,
  sql`delete from exm_exams`,
  sql`delete from exm_marks`,
  ...inserts(
    'exm_examinations',
    examinations.map((row) => ({
      id: row.id,
      title: row.title,
      exam_type: row.exam_type,
      start_date: day(row.start_date),
      end_date: day(row.end_date),
      semester: num(row.semester),
    }))
  ),
  ...inserts(
    'exm_exams',
    exams.map((exam) => ({
      id: exam.id,
      course_id: exam.course_id,
      subject: exam.subject ? subjectName(exam.subject) : null,
      title: exam.title,
      kind: exam.kind,
      exam_date: day(exam.exam_date),
      max_marks: num(exam.max_grades),
      grades_type: exam.grades_type,
      examination_id: exam.examination_id,
    }))
  ),
  ...inserts(
    'exm_marks',
    marks.map((mark) => ({
      exam_id: mark.exam_id,
      lms_user_id: mark.student_id,
      marks: num(mark.obtained),
      grade_text: mark.grade_text ? String(mark.grade_text).slice(0, 40) : null,
      graded_at: mark.graded_at,
      criteria: JSON.stringify(criteriaBySubmission.get(mark.sid) ?? null),
    }))
  ),
  sql`insert into sync_state (name, ran_at, detail)
      values ('exams', now(), ${JSON.stringify({
        from: FROM,
        examinations: examinations.length,
        exams: exams.length,
        marks: marks.length,
      })})
      on conflict (name) do update set ran_at = excluded.ran_at, detail = excluded.detail`,
]);

console.log('Saved:', {
  from: FROM,
  examinations: examinations.length,
  exams: exams.length,
  marks: marks.length,
  withCriteria: criteriaBySubmission.size,
});
