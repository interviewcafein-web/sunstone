// Copies PRIME domain assessments and AMCAT results for our students from the Sunstone LMS
// (through Redash) into the database: tests, which sections they were released to, who is in
// those sections, each student's best result, the subjects' syllabus (modules), and AMCAT
// sittings with section scores. Replaces the previous copy in one transaction.
//
//   REDASH_KEY=... npm run db:sync-assessments   (DATABASE_URL from .env.local)

import { neon } from '@neondatabase/serverless';

import { batchInserts } from './_insert';
import { titleText } from './_names';
import { redash } from './_redash';

/** The PRIME domain subjects for tech students, by their (hand-typed) LMS names. */
const PRIME_DOMAIN = `lower(trim(c.course_name)) in
  ('prime domain coding', 'competitive coding (sunstone prime tech domain)')`;

/** What kind of test this is, from its name. */
function category(name: string): string {
  if (/amcat/i.test(name)) return 'amcat_mock';
  if (/\bmcqs?\b/i.test(name)) return 'mcq';
  if (/practice test|\btest\b|weekly|quiz|assessment/i.test(name)) return 'test';
  return 'assignment';
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

const ids = (await sql`select lms_user_id from students where on_platform`).map((row) =>
  Number(row.lms_user_id)
);
if (!ids.length) throw new Error('No students in the database yet: run npm run db:import first.');
const idList = ids.join(',');
const list = (values: Iterable<number>) => [...new Set(values)].join(',') || 'null';

console.log(`Reading PRIME domain subjects for ${ids.length} students…`);

// 1. The PRIME subjects (LMS courses) our students' sections take, and those sections.
const courseSections = await redash<{ course_id: number; section_id: number }>(`
  select distinct ssm.subject_id course_id, ssm.section_id
  from subject_section_mapping ssm
  join course c on c.id = ssm.subject_id and c.status = '1'
  where ssm.status = '1' and ${PRIME_DOMAIN}
    and exists (select 1 from student_section_mapping m
                where m.section_id = ssm.section_id and m.status = '1' and m.student_id in (${idList}))`);
const courseIds = list(courseSections.map((row) => row.course_id));
const sectionIds = list(courseSections.map((row) => row.section_id));

// 2. Every test placed in those subjects: on the subject, a module, or a module's sub-folder.
interface Placement {
  aid: number;
  course_id: number;
  module_id: number | null;
  lecture_id: number | null;
  name: string;
  maximum_marks: number | null;
  minutes: number | null;
}
const placements = await redash<Placement>(`
  select am.academic_assessment_id aid, am.course_id,
         coalesce(am.academic_module_id, l.academic_module_id) module_id, am.academic_lecture_id lecture_id,
         trim(a.name) name, a.maximum_marks, a.total_time_minutes minutes
  from academic_assessment_mapping am
  join academic_assessment a on a.id = am.academic_assessment_id and a.status = '1'
  left join academic_lectures l on l.id = am.academic_lecture_id
  where am.status = '1' and am.course_id in (${courseIds})`);
const testIds = list(placements.map((placement) => placement.aid));

// 3. Their releases to our sections, past and scheduled.
const releases = await redash<{
  aid: number;
  course_id: number;
  module_id: number | null;
  section_id: number;
  release_at: string | null;
  due_date: string | null;
  visible: number;
}>(`
  select am.academic_assessment_id aid, am.course_id, am.academic_module_id module_id, ssm.section_id,
         max(s.release_at) release_at, max(s.due_date) due_date, max(s.is_visible = '1') visible
  from academic_assessment_section_scope s
  join academic_assessment_mapping am on am.id = s.base_mapping_id and am.status = '1'
  join subject_section_mapping ssm on ssm.id = s.subject_section_mapping_id and ssm.status = '1'
  where s.status = '1' and am.course_id in (${courseIds}) and ssm.section_id in (${sectionIds})
  group by am.academic_assessment_id, am.course_id, am.academic_module_id, ssm.section_id`);

const members = await redash<{ section_id: number; student_id: number }>(`
  select distinct section_id, student_id from student_section_mapping
  where status = '1' and section_id in (${sectionIds}) and student_id in (${idList})`);

const results = await redash<{
  aid: number;
  student_id: number;
  attempts: number;
  marks: number | null;
  max_marks: number | null;
  submitted: number;
  submitted_at: string | null;
}>(`
  select academic_assessment_id aid, student_id, count(*) attempts,
         max(total_marks_obtained) marks, max(max_marks) max_marks,
         max(submission_status = 'submitted') submitted, max(submitted_at) submitted_at
  from academic_assessment_submission
  where status = '1' and student_id in (${idList}) and academic_assessment_id in (${testIds})
  group by academic_assessment_id, student_id`);

const courses = await redash<{ id: number; name: string; modules: number; lectures: number }>(`
  select c.id, trim(c.course_name) name,
    (select count(*) from academic_modules m where m.course_id = c.id and m.status = '1') modules,
    (select count(*) from academic_lectures l where l.course_id = c.id and l.status = '1') lectures
  from course c where c.id in (${courseIds})`);

const modules = await redash<{
  id: number;
  course_id: number;
  name: string;
  position: number | null;
}>(`
  select id, course_id, trim(name) name, parent_module_priority position
  from academic_modules where status = '1' and course_id in (${courseIds})`);

const lectures = await redash<{
  id: number;
  course_id: number;
  module_id: number | null;
  title: string;
  position: number | null;
}>(`
  select id, course_id, academic_module_id module_id, trim(title) title, position_to_render position
  from academic_lectures where status = '1' and course_id in (${courseIds})`);

console.log('Reading AMCAT results…');
const sittings = await redash<{
  id: number;
  user_id: number;
  test_name: string;
  taken_at: string | null;
  status: string | null;
}>(`
  select asr.id, asr.user_id, coalesce(aat.display_name, aat.project_name) test_name,
         coalesce(asr.participant_start_date, asr.scheduled_date) taken_at, asr.participant_status status
  from amcat_assessment_results asr
  join amcat_assessment_types aat on aat.id = asr.assessment_type_id
  where asr.status = '1' and asr.user_id in (${idList})`);
const sectionScores = await redash<{
  assessment_id: number;
  name: string;
  score: string | null;
  total: string | null;
}>(`
  select ass.assessment_id, trim(ass.name) name, ass.score_obtained score, ass.total_score total
  from amcat_assessment_subjects ass
  join amcat_assessment_results asr on asr.id = ass.assessment_id
  where ass.status = '1' and asr.status = '1' and asr.user_id in (${idList})`);

// --- Shape the rows -----------------------------------------------------------------------

const number = (value: unknown) =>
  value === null || value === undefined || value === '' || Number.isNaN(Number(value))
    ? null
    : Number(value);

const tests = new Map<number, Placement>();
for (const placement of placements) tests.set(placement.aid, placement);

const scoresBySitting = new Map<
  number,
  { name: string; score: number | null; total: number | null }[]
>();
for (const row of sectionScores) {
  const sections = scoresBySitting.get(row.assessment_id) ?? [];
  sections.push({ name: row.name, score: number(row.score), total: number(row.total) });
  scoresBySitting.set(row.assessment_id, sections);
}

// --- Write --------------------------------------------------------------------------------

const inserts = <T extends Record<string, unknown>>(table: string, rows: T[]) =>
  batchInserts(sql, table, rows);

const counts = {
  subjects: courses.length,
  sectionsTakingSubjects: courseSections.length,
  placements: placements.length,
  lectures: lectures.length,
  scheduled: releases.filter(
    (release) =>
      release.release_at &&
      release.release_at > new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 19)
  ).length,
  tests: tests.size,
  releases: releases.length,
  sections: new Set(releases.map((release) => release.section_id)).size,
  sectionStudents: members.length,
  results: results.length,
  courses: courses.length,
  modules: modules.length,
  amcatSittings: sittings.length,
};

await sql.transaction([
  sql`delete from lms_courses`,
  sql`delete from lms_modules`,
  sql`delete from lms_tests`,
  sql`delete from lms_test_releases`,
  sql`delete from lms_section_students`,
  sql`delete from lms_lectures`,
  sql`delete from lms_test_placements`,
  sql`delete from lms_course_sections`,
  sql`delete from lms_test_results`,
  sql`delete from amcat_sittings`,
  ...inserts(
    'lms_courses',
    courses.map((course) => ({
      id: course.id,
      name: titleText(course.name),
      modules: Number(course.modules),
      lectures: Number(course.lectures),
    }))
  ),
  ...inserts(
    'lms_modules',
    modules.map((module) => ({
      id: module.id,
      course_id: module.course_id,
      name: titleText(module.name),
      position: number(module.position),
    }))
  ),
  ...inserts(
    'lms_tests',
    [...tests.values()].map((test) => ({
      id: test.aid,
      name: titleText(test.name ?? '') || 'Untitled',
      category: category(test.name ?? ''),
      max_marks: number(test.maximum_marks),
      minutes: number(test.minutes),
    }))
  ),
  ...inserts(
    'lms_test_releases',
    releases.map((release) => ({
      test_id: release.aid,
      section_id: release.section_id,
      course_id: release.course_id,
      module_id: release.module_id,
      release_at: release.release_at,
      due_at: release.due_date,
      visible: Number(release.visible) === 1,
    }))
  ),
  ...inserts(
    'lms_lectures',
    lectures.map((lecture) => ({
      id: lecture.id,
      course_id: lecture.course_id,
      module_id: lecture.module_id,
      title: titleText(lecture.title ?? '') || 'Untitled',
      position: number(lecture.position),
    }))
  ),
  ...inserts(
    'lms_test_placements',
    [...new Map(placements.map((p) => [`${p.aid}:${p.course_id}`, p])).values()].map((p) => ({
      test_id: p.aid,
      course_id: p.course_id,
      module_id: p.module_id,
      lecture_id: p.lecture_id,
    }))
  ),
  ...inserts(
    'lms_course_sections',
    courseSections.map((row) => ({ course_id: row.course_id, section_id: row.section_id }))
  ),
  ...inserts(
    'lms_section_students',
    members.map((member) => ({ section_id: member.section_id, lms_user_id: member.student_id }))
  ),
  ...inserts(
    'lms_test_results',
    results.map((result) => ({
      test_id: result.aid,
      lms_user_id: result.student_id,
      attempts: Number(result.attempts),
      marks: number(result.marks),
      max_marks: number(result.max_marks),
      submitted: Number(result.submitted) === 1,
      submitted_at: result.submitted_at,
    }))
  ),
  ...inserts(
    'amcat_sittings',
    sittings.map((sitting) => ({
      id: sitting.id,
      lms_user_id: sitting.user_id,
      test_name: sitting.test_name ?? 'AMCAT',
      taken_at: sitting.taken_at,
      status: sitting.status,
      sections: JSON.stringify(scoresBySitting.get(sitting.id) ?? []),
    }))
  ),
  sql`insert into sync_state (name, ran_at, detail) values ('assessments', now(), ${JSON.stringify(counts)})
      on conflict (name) do update set ran_at = excluded.ran_at, detail = excluded.detail`,
]);

console.log('Saved:', counts);
