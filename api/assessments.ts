// PRIME domain assessments (copied from the LMS by `npm run db:sync-assessments`). Staff only,
// and campus staff only for their campuses.
//
//   GET /api/assessments?view=campuses                    every campus at a glance
//   GET /api/assessments?view=campus&campus=ID[&batch=Y]  the campus's PRIME journey: subject
//        tests (with leaderboards), the module > sub-folder > test tree, timeline, students
//   GET /api/assessments?view=test&campus=ID&test=ID,ID[&batch=Y]  each student's marks
//                                                     (a test's section copies together)
//   GET /api/assessments?view=student&s=username          one student's tests and AMCAT
//   GET /api/assessments?view=metrics                     per-student numbers for the table
//
// The LMS keeps a copy of a subject, its modules and its tests for each group of sections.
// A campus sees one subject: copies are merged by name (subject, module, sub-folder, test).
// LMS times are India time without a zone, so "now" is compared in India time too.

import { type Viewer, json, seesCampus, sessionViewer } from './_auth';
import { db } from './_db';

export const config = { runtime: 'edge' };

const int = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : null);
const NOW = `(now() at time zone 'Asia/Kolkata')`;

// One campus (and optionally one batch): its students, their PRIME sections, the subjects
// those sections take, visible releases, the ones already out ("done"), who was given each
// released test, and per-test totals. $1 = campus id, $2 = admission year or null.
const SCOPE = `
  roster as (
    select lms_user_id, name, username, admission_year, program
    from students where on_platform and campus_id = $1 and ($2::int is null or admission_year = $2)),
  sec as (
    select ss.section_id, ss.lms_user_id from lms_section_students ss join roster using (lms_user_id)),
  courses_in as (
    select distinct cs.course_id from lms_course_sections cs
    where cs.section_id in (select section_id from sec)),
  rel as (
    select r.* from lms_test_releases r
    where r.visible and r.section_id in (select section_id from sec)),
  done as (select * from rel where release_at <= ${NOW}),
  eligible as (
    select distinct d.test_id, s.lms_user_id from done d join sec s using (section_id)),
  res as (
    select e.test_id, e.lms_user_id, tr.marks, tr.submitted, tr.attempts, tr.submitted_at,
           coalesce(tr.max_marks, t.max_marks) as max_marks,
           tr.marks / nullif(coalesce(tr.max_marks, t.max_marks), 0) * 100 as pct
    from eligible e
    join lms_tests t on t.id = e.test_id
    left join lms_test_results tr on tr.test_id = e.test_id and tr.lms_user_id = e.lms_user_id)`;

async function lastSync() {
  const [row] =
    await db()`select ran_at::text as ran_at from sync_state where name = 'assessments'`;
  return row ? String(row.ran_at) : null;
}

export type TestStatus = 'completed' | 'live' | 'scheduled' | 'unscheduled';

function statusOf(released: string | null, due: string | null, now: string): TestStatus {
  if (!released) return 'unscheduled';
  if (released > now) return 'scheduled';
  if (due && due > now) return 'live';
  return 'completed';
}

async function campuses(viewer: Viewer) {
  const rows = await db().query(
    `with roster as (
       select lms_user_id, campus_id, campus from students
       where on_platform and campus_id is not null and ($1::int[] is null or campus_id = any($1::int[]))),
     sec as (select ss.section_id, r.lms_user_id, r.campus_id from lms_section_students ss join roster r using (lms_user_id)),
     done as (select * from lms_test_releases where visible and release_at <= ${NOW}),
     eligible as (
       select distinct d.test_id, sec.lms_user_id, sec.campus_id from done d join sec using (section_id)),
     res as (
       select e.campus_id, e.test_id, e.lms_user_id, tr.submitted,
              lower(trim(t.name)) || '|' || coalesce(t.max_marks::text, '') as test_key,
              tr.marks / nullif(coalesce(tr.max_marks, t.max_marks), 0) * 100 as pct
       from eligible e join lms_tests t on t.id = e.test_id
       left join lms_test_results tr on tr.test_id = e.test_id and tr.lms_user_id = e.lms_user_id),
     upcoming as (
       select sec.campus_id, count(distinct lower(trim(t.name)))::int as scheduled
       from lms_test_releases r join sec using (section_id) join lms_tests t on t.id = r.test_id
       where r.visible and r.release_at > ${NOW} group by sec.campus_id),
     last_test as (
       select sec.campus_id, max(d.release_at) as at from done d join sec using (section_id) group by sec.campus_id)
     select c.campus_id as id, c.campus as name, count(distinct c.lms_user_id)::int as students,
       (select count(distinct s.lms_user_id) from sec s where s.campus_id = c.campus_id)::int as in_prime,
       count(distinct res.test_key)::int as tests,
       count(*) filter (where res.submitted)::int as submissions,
       count(res.test_id)::int as expected,
       round(avg(res.pct) filter (where res.submitted))::int as avg_pct,
       coalesce((select scheduled from upcoming u where u.campus_id = c.campus_id), 0) as scheduled,
       (select round(100.0 * sum(a.present) / nullif(sum(a.sessions), 0))::int
          from att_student_subject a join roster r2 using (lms_user_id)
          where r2.campus_id = c.campus_id) as attendance_pct,
       (select at::text from last_test l where l.campus_id = c.campus_id) as last_test_at
     from roster c left join res on res.lms_user_id = c.lms_user_id and res.campus_id = c.campus_id
     group by c.campus_id, c.campus
     order by tests desc, c.campus`,
    [viewer.campusIds]
  );
  return { campuses: rows, syncedAt: await lastSync() };
}

interface GroupRow {
  subject_key: string;
  subject: string;
  module_key: string | null;
  module: string | null;
  lecture_key: string | null;
  lecture: string | null;
  name: string;
  category: string;
  max_marks: string | null;
  minutes: number | null;
  ids: number[];
  released_at: string | null;
  last_release_at: string | null;
  due_at: string | null;
  eligible: number;
  submitted: number;
  avg_pct: number | null;
  top_pct: number | null;
}

async function campus(campusId: number, batch: number | null) {
  const params = [campusId, batch];
  const [{ now }] = await db().query(`select ${NOW}::text as now`);

  // Every test placed in the campus's subjects, section copies merged, with release dates
  // and totals over the students it was given to.
  const groups = (await db().query(
    `with ${SCOPE},
     stats as (
       select test_id, count(*)::int as eligible, count(*) filter (where submitted)::int as submitted,
              sum(pct) filter (where submitted) as pct_sum, max(pct) filter (where submitted) as top
       from res group by test_id),
     released as (
       select test_id, min(release_at) as first_at, max(release_at) as last_at, max(due_at) as due_at
       from rel group by test_id)
     select lower(trim(c.name)) as subject_key, min(c.name) as subject,
            lower(trim(m.name)) as module_key, min(m.name) as module,
            lower(trim(l.title)) as lecture_key, min(l.title) as lecture,
            min(t.name) as name, min(t.category) as category, t.max_marks, max(t.minutes) as minutes,
            array_agg(distinct t.id order by t.id) as ids,
            min(rl.first_at)::text as released_at, max(rl.last_at)::text as last_release_at,
            max(rl.due_at)::text as due_at,
            coalesce(sum(st.eligible), 0)::int as eligible,
            coalesce(sum(st.submitted), 0)::int as submitted,
            round(sum(st.pct_sum) / nullif(sum(st.submitted), 0))::int as avg_pct,
            round(max(st.top))::int as top_pct
     from lms_test_placements p
     join lms_tests t on t.id = p.test_id
     join lms_courses c on c.id = p.course_id
     left join lms_modules m on m.id = p.module_id
     left join lms_lectures l on l.id = p.lecture_id
     left join released rl on rl.test_id = p.test_id
     left join stats st on st.test_id = p.test_id
     where p.course_id in (select course_id from courses_in)
     group by lower(trim(c.name)), lower(trim(m.name)), lower(trim(l.title)), lower(trim(t.name)), t.max_marks`,
    params
  )) as GroupRow[];

  // The syllabus: modules and their sub-folders, merged across copies, in order.
  const modules = await db().query(
    `with ${SCOPE}
     select lower(trim(c.name)) as subject_key, lower(trim(m.name)) as key, min(m.name) as name,
            -- copies number their modules differently; the average keeps the usual order
            avg(m.position) as position
     from lms_modules m join lms_courses c on c.id = m.course_id
     where m.course_id in (select course_id from courses_in)
     group by 1, 2 order by 1, position nulls last, name`,
    params
  );
  const lectures = await db().query(
    `with ${SCOPE}
     select lower(trim(c.name)) as subject_key, lower(trim(m.name)) as module_key,
            lower(trim(l.title)) as key, min(l.title) as title, avg(l.position) as position
     from lms_lectures l join lms_modules m on m.id = l.module_id join lms_courses c on c.id = l.course_id
     where l.course_id in (select course_id from courses_in)
     group by 1, 2, 3 order by position nulls last, title`,
    params
  );

  const tests = groups
    .map((group) => ({ ...group, status: statusOf(group.released_at, group.due_at, now) }))
    // Unscheduled placeholders are noise: "Untitled" drafts, and stray copies of module
    // tests that some subject copies hold without a module (the real ones are in the tree).
    // An unscheduled test on the subject itself is kept only if it is a mock test.
    .filter(
      (test) =>
        test.status !== 'unscheduled' ||
        (!/^untitled\b/i.test(test.name) && (Boolean(test.module_key) || /mock/i.test(test.name)))
    );

  // Leaderboards for subject-level tests (e.g. AMCAT mocks) that are out.
  const boardIds = tests
    .filter((test) => !test.module_key && (test.status === 'completed' || test.status === 'live'))
    .flatMap((test) => test.ids);
  const boardRows = boardIds.length
    ? await db().query(
        `with ${SCOPE}
         select res.test_id, r.name, r.username, round(res.pct)::int as pct, res.marks,
                res.submitted_at::text as submitted_at
         from res join roster r using (lms_user_id)
         where res.submitted and res.test_id = any($3::int[])
         order by res.pct desc nulls last, res.submitted_at`,
        [campusId, batch, boardIds]
      )
    : [];

  const subjectTests = tests
    .filter((test) => !test.module_key)
    .map((test) => {
      const ids = new Set(test.ids);
      return {
        ...test,
        leaders: boardRows
          .filter((row) => ids.has(Number(row.test_id)))
          .slice(0, 3)
          .map(({ name, username, pct }) => ({ name, username, pct })),
      };
    });

  // subject > module > sub-folder > tests
  const subjects = [...new Set(tests.map((test) => test.subject_key))].map((subjectKey) => {
    const subjectTestsHere = tests.filter((test) => test.subject_key === subjectKey);
    const tree = modules
      .filter((module) => module.subject_key === subjectKey)
      .map((module) => {
        const inModule = subjectTestsHere.filter((test) => test.module_key === module.key);
        const folders = lectures
          .filter(
            (lecture) => lecture.subject_key === subjectKey && lecture.module_key === module.key
          )
          .map((lecture) => ({
            title: String(lecture.title),
            tests: inModule.filter((test) => test.lecture_key === lecture.key),
          }))
          .filter((folder) => folder.tests.length > 0);
        const out = inModule.filter(
          (test) => test.status === 'completed' || test.status === 'live'
        );
        return {
          name: String(module.name),
          tests: inModule.filter((test) => !test.lecture_key),
          folders,
          total: inModule.length,
          released: out.length,
          started: out.length > 0,
        };
      });
    return {
      key: subjectKey,
      name: subjectTestsHere[0]?.subject ?? subjectKey,
      modules: tree,
    };
  });

  const out = tests.filter((test) => test.status === 'completed' || test.status === 'live');
  const totals = out.reduce(
    (sum, test) => ({
      submitted: sum.submitted + test.submitted,
      eligible: sum.eligible + test.eligible,
      pct: sum.pct + (test.avg_pct ?? 0) * test.submitted,
    }),
    { submitted: 0, eligible: 0, pct: 0 }
  );
  const allModules = subjects.flatMap((subject) => subject.modules);

  // Tests released per week, with the week's average score.
  const weeks = new Map<string, { week: string; tests: number; submitted: number; pct: number }>();
  for (const test of out) {
    const day = new Date(`${test.released_at!.slice(0, 10)}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7)); // Monday
    const week = day.toISOString().slice(0, 10);
    const entry = weeks.get(week) ?? { week, tests: 0, submitted: 0, pct: 0 };
    entry.tests += 1;
    entry.submitted += test.submitted;
    entry.pct += (test.avg_pct ?? 0) * test.submitted;
    weeks.set(week, entry);
  }
  const timeline = [...weeks.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((week) => ({
      week: week.week,
      tests: week.tests,
      avg_pct: week.submitted ? Math.round(week.pct / week.submitted) : null,
    }));

  const [counts] = await db().query(
    `with ${SCOPE}
     select (select count(*) from roster)::int as students,
            (select count(distinct lms_user_id) from sec)::int as in_prime`,
    params
  );
  // Every student on the campus (in PRIME sections or not), with tests, attendance and AMCAT.
  const students = await db().query(
    `with ${SCOPE},
     tests as (
       select lms_user_id, count(*)::int as released,
              count(*) filter (where submitted)::int as submitted,
              round(avg(pct) filter (where submitted))::int as avg_pct,
              max(submitted_at)::text as last_submitted_at
       from res group by lms_user_id),
     att as (
       select lms_user_id, sum(sessions)::int as sessions, sum(present)::int as present,
              sum(sessions) filter (where ${PRIME_SUBJECT})::int as prime_sessions,
              sum(present) filter (where ${PRIME_SUBJECT})::int as prime_present
       from att_student_subject where lms_user_id in (select lms_user_id from roster)
       group by lms_user_id),
     exams as (
       select m.lms_user_id, round(avg(m.marks / nullif(e.max_marks, 0) * 100))::int as exam_avg
       from exm_marks m join exm_exams e on e.id = m.exam_id
       where e.kind = 'other' and m.lms_user_id in (select lms_user_id from roster)
       group by m.lms_user_id),
     amcat as (
       select a.lms_user_id, count(distinct a.id)::int as sittings,
              round(avg((x->>'score')::numeric) filter (where x->>'score' ~ '^[0-9.]+$'))::int as avg_score
       from amcat_sittings a cross join lateral jsonb_array_elements(a.sections) x
       where a.lms_user_id in (select lms_user_id from roster)
       group by a.lms_user_id)
     select r.name, r.username, r.admission_year, r.program,
            coalesce(t.released, 0) as released, coalesce(t.submitted, 0) as submitted,
            t.avg_pct, t.last_submitted_at,
            round(100.0 * at.present / nullif(at.sessions, 0))::int as attendance_pct,
            coalesce(at.sessions, 0) as sessions,
            round(100.0 * at.prime_present / nullif(at.prime_sessions, 0))::int as prime_attendance_pct,
            coalesce(am.sittings, 0) as amcat, am.avg_score as amcat_avg, ex.exam_avg
     from roster r
     left join tests t using (lms_user_id)
     left join att at using (lms_user_id)
     left join amcat am using (lms_user_id)
     left join exams ex using (lms_user_id)
     where t.lms_user_id is not null or at.lms_user_id is not null or am.lms_user_id is not null
        or ex.lms_user_id is not null
     order by t.avg_pct desc nulls last, t.submitted desc nulls last, r.name`,
    params
  );
  const batches = (
    await db()`
      select distinct admission_year from students
      where on_platform and campus_id = ${campusId} and admission_year is not null
      order by admission_year desc`
  ).map((row) => Number(row.admission_year));

  return {
    summary: {
      students: counts.students,
      in_prime: counts.in_prime,
      tests: out.length,
      scheduled: tests.filter((test) => test.status === 'scheduled').length,
      unscheduled: tests.filter((test) => test.status === 'unscheduled').length,
      submissions: totals.submitted,
      expected: totals.eligible,
      avg_pct: totals.submitted ? Math.round(totals.pct / totals.submitted) : null,
      modules: allModules.length,
      modules_started: allModules.filter((module) => module.started).length,
    },
    subjectTests,
    subjects,
    timeline,
    students,
    attendance: await attendance(campusId, batch),
    amcat: await amcatRounds(campusId, batch),
    exams: await internalExams(campusId, batch),
    batches,
    now,
    syncedAt: await lastSync(),
  };
}

// PRIME subjects in attendance (named by hand in the LMS: "Prime Domain Coding", "Prime
// Aptitude", "Competitive Coding (Sunstone Prime Tech Domain)"...).
const PRIME_SUBJECT = `subject ~* '(^|[^a-z])prime([^a-z]|$)|competitive coding'`;

/** Class attendance for one campus (and batch): overall, PRIME, weekly, per subject and instructor. */
async function attendance(campusId: number, batch: number | null) {
  const params = [campusId, batch];
  const ROSTER = `roster as (
    select lms_user_id from students
    where on_platform and campus_id = $1 and ($2::int is null or admission_year = $2))`;
  const [overall] = await db().query(
    `with ${ROSTER}
     select sum(sessions)::int as marks, sum(present)::int as present,
            count(distinct lms_user_id)::int as students,
            sum(sessions) filter (where ${PRIME_SUBJECT})::int as prime_marks,
            sum(present) filter (where ${PRIME_SUBJECT})::int as prime_present
     from att_student_subject where lms_user_id in (select lms_user_id from roster)`,
    params
  );
  const weeks = await db().query(
    `with ${ROSTER}
     select week::text as week, sum(sessions)::int as marks,
            round(100.0 * sum(present) / nullif(sum(sessions), 0))::int as pct
     from att_student_week where lms_user_id in (select lms_user_id from roster)
     group by week order by week`,
    params
  );
  const subjects = await db().query(
    `with ${ROSTER}
     select min(subject) as subject, count(distinct lms_user_id)::int as students,
            sum(sessions)::int as marks,
            round(100.0 * sum(present) / nullif(sum(sessions), 0))::int as pct,
            bool_or(${PRIME_SUBJECT}) as prime
     from att_student_subject where lms_user_id in (select lms_user_id from roster)
     group by lower(subject) having sum(sessions) >= 20
     order by prime desc, marks desc limit 30`,
    params
  );
  // Instructors teach sections, not batches, so this is for the whole campus.
  const faculty = await db()`
    select faculty_id, min(faculty) as faculty, count(*)::int as sessions,
           sum(marked)::int as marks, round(100.0 * sum(present) / nullif(sum(marked), 0))::int as pct,
           string_agg(distinct subject, ', ') as subjects,
           bool_or(subject ~* '(^|[^a-z])prime([^a-z]|$)|competitive coding') as prime,
           max(lecture_date)::text as last_class
    from att_sessions where campus_id = ${campusId} and faculty_id is not null
    group by faculty_id having count(*) >= 3
    order by prime desc, sessions desc`;
  const [{ synced }] = await db()`
    select (select ran_at::text from sync_state where name = 'attendance') as synced`;
  return {
    marks: overall?.marks ?? 0,
    pct: overall?.marks ? Math.round((100 * overall.present) / overall.marks) : null,
    prime_pct: overall?.prime_marks
      ? Math.round((100 * overall.prime_present) / overall.prime_marks)
      : null,
    students: overall?.students ?? 0,
    weeks,
    subjects,
    faculty,
    syncedAt: synced,
  };
}

// An exam's event and half-year term, e.g. "midterm_1:2026-2" (Midterm 1, Jul-Dec 2026), so
// this term's Midterm 1 is not merged with last term's.
const EXAM_EVENT = `coalesce(x.exam_type, 'other') || ':' ||
  to_char(coalesce(e.exam_date, x.start_date, x.end_date), 'YYYY') || '-' ||
  case when extract(month from coalesce(e.exam_date, x.start_date, x.end_date)) >= 7 then '2' else '1' end`;

// One campus's (and batch's) internal exam marks, with the exam, its event and the score %.
const EXAM_MARKS = `
  roster as (
    select lms_user_id, name, username from students
    where on_platform and campus_id = $1 and ($2::int is null or admission_year = $2)),
  mk as (
    select m.*, e.subject, e.title, e.kind, e.exam_date, e.max_marks,
           ${EXAM_EVENT} as event,
           m.marks / nullif(e.max_marks, 0) * 100 as pct
    from exm_marks m join roster r using (lms_user_id)
    join exm_exams e on e.id = m.exam_id
    left join exm_examinations x on x.id = e.examination_id)`;

/** Internal exams (Midterms, End-term) and Mock PI / GD for one campus and batch. */
async function internalExams(campusId: number, batch: number | null) {
  const params = [campusId, batch];
  const events = await db().query(
    `with ${EXAM_MARKS}
     select event, kind, count(distinct lms_user_id)::int as students,
            count(distinct lower(coalesce(subject, title)))::int as subjects,
            count(*)::int as marks, count(pct)::int as scored,
            round(avg(pct))::int as avg_pct,
            round(100.0 * count(*) filter (where pct >= 40) / nullif(count(pct), 0))::int as pass_pct,
            count(*) filter (where pct is null and (grade_text is null or upper(grade_text) in ('AB', 'ABSENT')))::int as absent,
            min(exam_date)::text as first_date, max(exam_date)::text as last_date
     from mk group by event, kind
     order by case kind when 'other' then 0 else 1 end, event desc`,
    params
  );
  const subjects = await db().query(
    `with ${EXAM_MARKS}
     select event, kind, min(coalesce(subject, title)) as subject,
            count(distinct lms_user_id)::int as students,
            round(avg(pct))::int as avg_pct,
            round(100.0 * count(*) filter (where pct >= 40) / nullif(count(pct), 0))::int as pass_pct,
            max(max_marks) as max_marks, max(exam_date)::text as exam_date,
            lower(coalesce(subject, title)) as subject_key
     from mk group by event, kind, lower(coalesce(subject, title))
     order by event, avg_pct nulls last`,
    params
  );
  // Letter grades (subjects graded A+, A, B…), counted per subject.
  const grades = await db().query(
    `with ${EXAM_MARKS}
     select event, kind, lower(coalesce(subject, title)) as subject_key, grade_text as grade,
            count(*)::int as n
     from mk where pct is null and grade_text is not null and grade_text <> ''
       and upper(grade_text) not in ('AB', 'ABSENT')
     group by 1, 2, 3, 4 order by n desc`,
    params
  );
  for (const subject of subjects) {
    subject.grades = grades
      .filter(
        (grade) =>
          grade.event === subject.event &&
          grade.kind === subject.kind &&
          grade.subject_key === subject.subject_key
      )
      .slice(0, 5)
      .map(({ grade, n }) => ({ grade, n }));
  }
  const criteria = await db().query(
    `with ${EXAM_MARKS}
     select kind, c->>'name' as name,
            round(avg((c->>'marks')::numeric / nullif((c->>'max')::numeric, 0) * 100))::int as avg_pct,
            count(*)::int as scores
     from mk cross join lateral jsonb_array_elements(
       case when jsonb_typeof(criteria) = 'array' then criteria else '[]'::jsonb end) c
     where kind in ('mock_pi', 'mock_gd') and c->>'marks' ~ '^[0-9.]+$'
     group by kind, c->>'name' order by kind, min(c->>'name')`,
    params
  );
  const [{ synced }] = await db()`
    select (select ran_at::text from sync_state where name = 'exams') as synced`;
  return { events, subjects, criteria, syncedAt: synced };
}

/** AMCAT rounds (from the AMCAT platform) taken by one campus's students. */
async function amcatRounds(campusId: number, batch: number | null) {
  const params = [campusId, batch];
  const BASE = `
    roster as (
      select lms_user_id, name, username from students
      where on_platform and campus_id = $1 and ($2::int is null or admission_year = $2)),
    s as (select a.* from amcat_sittings a join roster r using (lms_user_id)),
    scores as (
      select s.id, s.test_name, s.lms_user_id, x->>'name' as section,
             case when x->>'score' ~ '^[0-9.]+$' then (x->>'score')::numeric end as score
      from s cross join lateral jsonb_array_elements(s.sections) x)`;
  const rounds = await db().query(
    `with ${BASE}
     select s.test_name, count(distinct s.lms_user_id)::int as students,
            min(s.taken_at)::text as first_at, max(s.taken_at)::text as last_at,
            (select round(avg(score))::int from scores sc where sc.test_name = s.test_name) as avg_score,
            (select json_agg(json_build_object('name', section, 'avg', avg, 'takers', takers) order by takers desc)
               from (select section, round(avg(score))::int as avg, count(score)::int as takers
                     from scores sc where sc.test_name = s.test_name group by section) x) as sections,
            (select json_agg(t) from (
               select r.name, r.username, round(avg(sc.score))::int as avg
               from scores sc join roster r using (lms_user_id)
               where sc.test_name = s.test_name and sc.score is not null
               group by r.lms_user_id, r.name, r.username
               order by avg desc limit 5) t) as top
     from s group by s.test_name order by max(s.taken_at) desc nulls last`,
    params
  );
  const sections = await db().query(
    `with ${BASE}
     select section as name, round(avg(score))::int as avg, count(score)::int as takers
     from scores group by section having count(score) > 0 order by takers desc`,
    params
  );
  return { rounds, sections };
}

async function test(campusId: number, batch: number | null, testIds: number[]) {
  const [info] = await db()`
    select min(name) as name, min(category) as category, max(max_marks) as max_marks,
           max(minutes) as minutes, count(*)::int as copies
    from lms_tests where id = any(${testIds}::int[]) having count(*) > 0`;
  if (!info) return null;
  const students = await db().query(
    `with ${SCOPE}
     select r.name, r.username, r.admission_year, r.program,
            res.marks, res.max_marks, coalesce(res.submitted, false) as submitted,
            res.attempts, res.submitted_at::text as submitted_at, round(res.pct)::int as pct
     from res join roster r using (lms_user_id)
     where res.test_id = any($3::int[])
     order by res.submitted desc nulls last, res.pct desc nulls last, res.submitted_at, r.name`,
    [campusId, batch, testIds]
  );
  return { test: info, students };
}

async function student(viewer: Viewer, username: string) {
  const [person] = await db()`
    select lms_user_id, campus_id, name, username from students
    where on_platform and lower(username) = lower(${username})`;
  if (!person || !seesCampus(viewer, person.campus_id == null ? null : Number(person.campus_id))) {
    return null;
  }
  const [{ now }] = await db().query(`select ${NOW}::text as now`);
  const rows = await db()`
    with mine as (
      select r.test_id, min(r.release_at) as release_at, max(r.due_at) as due_at
      from lms_test_releases r
      join lms_section_students ss on ss.section_id = r.section_id
      where ss.lms_user_id = ${person.lms_user_id} and r.visible
      group by r.test_id),
    classmates as (
      select distinct r.test_id, ss.lms_user_id from lms_test_releases r
      join lms_section_students ss on ss.section_id = r.section_id
      where r.visible and r.test_id in (select test_id from mine))
    select t.id, t.name, t.category, coalesce(tr.max_marks, t.max_marks) as max_marks,
           mine.release_at::text as released_at, mine.due_at::text as due_at,
           (select min(c.name) from lms_test_placements p join lms_courses c on c.id = p.course_id
             where p.test_id = t.id) as subject,
           (select min(m.name) from lms_test_placements p join lms_modules m on m.id = p.module_id
             where p.test_id = t.id) as module,
           (select min(l.title) from lms_test_placements p join lms_lectures l on l.id = p.lecture_id
             where p.test_id = t.id) as lecture,
           tr.marks, coalesce(tr.submitted, false) as submitted, tr.attempts,
           tr.submitted_at::text as submitted_at,
           round(tr.marks / nullif(coalesce(tr.max_marks, t.max_marks), 0) * 100)::int as pct,
           (select round(avg(o.marks / nullif(coalesce(o.max_marks, t.max_marks), 0) * 100))::int
              from lms_test_results o
              where o.test_id = t.id and o.submitted
                and o.lms_user_id in (select lms_user_id from classmates c where c.test_id = t.id)) as class_avg_pct,
           (select 1 + count(*) from lms_test_results o
              where o.test_id = t.id and o.submitted and tr.submitted
                and o.lms_user_id in (select lms_user_id from classmates c where c.test_id = t.id)
                and o.marks > tr.marks)::int as rank,
           (select count(*) from lms_test_results o
              where o.test_id = t.id and o.submitted
                and o.lms_user_id in (select lms_user_id from classmates c where c.test_id = t.id))::int as takers
    from mine join lms_tests t on t.id = mine.test_id
    left join lms_test_results tr on tr.test_id = t.id and tr.lms_user_id = ${person.lms_user_id}
    order by mine.release_at desc nulls last`;
  const tests = rows.map((row) => ({
    ...row,
    // A rank only means something for a submitted test.
    rank: row.submitted ? row.rank : null,
    status: statusOf(row.released_at as string | null, row.due_at as string | null, now),
  }));
  const amcat = await db()`
    select id, test_name, taken_at::text as taken_at, status, sections
    from amcat_sittings where lms_user_id = ${person.lms_user_id}
    order by taken_at desc nulls last`;
  const attendanceSubjects = await db()`
    select min(subject) as subject, sum(sessions)::int as sessions, sum(present)::int as present,
           round(100.0 * sum(present) / nullif(sum(sessions), 0))::int as pct,
           max(last_date)::text as last_date,
           bool_or(subject ~* '(^|[^a-z])prime([^a-z]|$)|competitive coding') as prime
    from att_student_subject where lms_user_id = ${person.lms_user_id}
    group by lower(subject) order by prime desc, sessions desc`;
  const attendanceWeeks = await db()`
    select week::text as week, sessions, present,
           round(100.0 * present / nullif(sessions, 0))::int as pct
    from att_student_week where lms_user_id = ${person.lms_user_id} order by week`;
  const exams = await db()`
    select e.id,
           coalesce(x.exam_type, 'other') || ':' ||
             to_char(coalesce(e.exam_date, x.start_date, x.end_date), 'YYYY') || '-' ||
             case when extract(month from coalesce(e.exam_date, x.start_date, x.end_date)) >= 7
                  then '2' else '1' end as event,
           e.kind, coalesce(e.subject, e.title) as subject,
           e.title, e.exam_date::text as exam_date, e.max_marks, m.marks, m.grade_text, m.criteria,
           round(m.marks / nullif(e.max_marks, 0) * 100)::int as pct,
           (select round(avg(o.marks / nullif(e.max_marks, 0) * 100))::int
              from exm_marks o where o.exam_id = e.id) as class_avg_pct
    from exm_marks m join exm_exams e on e.id = m.exam_id
    left join exm_examinations x on x.id = e.examination_id
    where m.lms_user_id = ${person.lms_user_id}
    order by e.exam_date desc nulls last, subject`;
  return {
    tests,
    amcat,
    exams,
    attendance: { subjects: attendanceSubjects, weeks: attendanceWeeks },
    now,
    syncedAt: await lastSync(),
  };
}

/**
 * For the students table: per student (by username) the viewer may see, attendance, AMCAT
 * sitting averages in date order (for the trend), and PRIME test average and counts.
 */
async function metrics(viewer: Viewer) {
  const rows = await db().query(
    `with roster as (
       select lms_user_id, username from students
       where on_platform and ($1::int[] is null or campus_id = any($1::int[]))),
     att as (
       select lms_user_id, sum(sessions) as s, sum(present) as p,
              sum(sessions) filter (where ${PRIME_SUBJECT}) as ps,
              sum(present) filter (where ${PRIME_SUBJECT}) as pp
       from att_student_subject where lms_user_id in (select lms_user_id from roster)
       group by lms_user_id),
     sittings as (
       select a.lms_user_id, a.taken_at, round(avg((x->>'score')::numeric))::int as score
       from amcat_sittings a cross join lateral jsonb_array_elements(a.sections) x
       where x->>'score' ~ '^[0-9.]+$' and a.lms_user_id in (select lms_user_id from roster)
       group by a.id, a.lms_user_id, a.taken_at),
     am as (
       select lms_user_id, json_agg(json_build_array(taken_at::date::text, score) order by taken_at) as list
       from sittings group by lms_user_id),
     done as (
       select test_id, section_id from lms_test_releases where visible and release_at <= ${NOW}),
     eligible as (
       select distinct d.test_id, ss.lms_user_id from done d join lms_section_students ss using (section_id)
       where ss.lms_user_id in (select lms_user_id from roster)),
     tst as (
       select e.lms_user_id, count(*)::int as released, count(*) filter (where tr.submitted)::int as submitted,
              round(avg(tr.marks / nullif(coalesce(tr.max_marks, t.max_marks), 0) * 100)
                    filter (where tr.submitted))::int as avg
       from eligible e join lms_tests t on t.id = e.test_id
       left join lms_test_results tr on tr.test_id = e.test_id and tr.lms_user_id = e.lms_user_id
       group by e.lms_user_id)
     select r.username,
            round(100.0 * att.p / nullif(att.s, 0))::int as attendance,
            round(100.0 * att.pp / nullif(att.ps, 0))::int as prime_attendance,
            am.list as amcat, tst.avg as test_avg, tst.submitted, tst.released
     from roster r
     left join att using (lms_user_id) left join am using (lms_user_id) left join tst using (lms_user_id)
     where att.lms_user_id is not null or am.lms_user_id is not null or tst.lms_user_id is not null`,
    [viewer.campusIds]
  );
  return {
    students: Object.fromEntries(rows.map(({ username, ...rest }) => [String(username), rest])),
  };
}

export default async function handler(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL) return json(404, { error: 'No database configured' });
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Login required' });

  const params = new URL(request.url).searchParams;
  const view = params.get('view');
  try {
    if (view === 'campuses') return json(200, await campuses(viewer));
    if (view === 'metrics') return json(200, await metrics(viewer));
    if (view === 'student') {
      const result = await student(viewer, params.get('s') ?? '');
      return result ? json(200, result) : json(404, { error: 'Student not found' });
    }

    const campusId = int(params.get('campus'));
    if (campusId === null) return json(400, { error: 'Choose a campus' });
    if (!seesCampus(viewer, campusId)) {
      return json(403, { error: 'You do not have access to this campus' });
    }
    const batch = int(params.get('batch'));

    if (view === 'campus') return json(200, await campus(campusId, batch));
    if (view === 'test') {
      // One test, or the ids of its section copies: "123,456".
      const testIds = (params.get('test') ?? '')
        .split(',')
        .map(int)
        .filter((id) => id !== null);
      const result = testIds.length ? await test(campusId, batch, testIds as number[]) : null;
      return result ? json(200, result) : json(404, { error: 'Test not found' });
    }
    return json(400, { error: 'Unknown view' });
  } catch (error) {
    console.error('[assessments]', error);
    return json(503, { error: 'Assessments could not be loaded. Try again shortly.' });
  }
}
