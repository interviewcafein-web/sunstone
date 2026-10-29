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
import { integrityOf } from '../src/lib/integrity';

export const config = { runtime: 'edge' };

const int = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : null);
const NOW = `(now() at time zone 'Asia/Kolkata')`;
const BATCH_FILTER = /^(\d{4}|[A-Za-z. ]{2,20}:(\d{4})?)$/;

// A batch filter ($2): an admission year ("2025"), a whole program ("BCA:"), a cohort, program
// and admission year ("BCA:2025", shown as BCA25-28), or null for everyone.
const COHORT = `($2::text is null or admission_year::text = $2 or program || ':' = $2
  or program || ':' || admission_year = $2)`;

// One campus (and optionally one batch): its students, their PRIME sections, the subjects
// those sections take, visible releases, the ones already out ("done"), who was given each
// released test, and per-test totals. $1 = campus id, $2 = admission year or null.
const SCOPE = `
  roster as (
    select lms_user_id, name, username, admission_year, program
    from students where on_platform and campus_id = $1 and ${COHORT}),
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
       (select at::text from last_test l where l.campus_id = c.campus_id) as last_test_at,
       (select logo_url from campuses k where k.id = c.campus_id) as logo
     from roster c left join res on res.lms_user_id = c.lms_user_id and res.campus_id = c.campus_id
     group by c.campus_id, c.campus
     order by tests desc, c.campus`,
    [viewer.campusIds]
  );
  // Weekly trends per campus over the last ten weeks: attendance, and the average score on
  // tests released that week.
  const attendanceWeeks = await db().query(
    `select s.campus_id, w.week, round(100.0 * sum(w.present) / nullif(sum(w.sessions), 0))::int as pct
     from att_student_week w join students s using (lms_user_id)
     where s.on_platform and ($1::int[] is null or s.campus_id = any($1::int[]))
       and w.week >= current_date - 77 and w.week < date_trunc('week', current_date)::date
     group by s.campus_id, w.week order by w.week`,
    [viewer.campusIds]
  );
  const testWeeks = await db().query(
    `with scored as (
       select s.campus_id, date_trunc('week', min(r.release_at)) as week,
              max(tr.marks / nullif(coalesce(tr.max_marks, t.max_marks), 0) * 100) as pct
       from lms_test_results tr
       join students s on s.lms_user_id = tr.lms_user_id
       join lms_section_students ss on ss.lms_user_id = tr.lms_user_id
       join lms_test_releases r on r.test_id = tr.test_id and r.section_id = ss.section_id and r.visible
       join lms_tests t on t.id = tr.test_id
       where tr.submitted and s.on_platform and ($1::int[] is null or s.campus_id = any($1::int[]))
       group by s.campus_id, tr.test_id, tr.lms_user_id)
     select campus_id, week, round(avg(pct))::int as pct from scored
     where week >= current_date - 77 and week < date_trunc('week', current_date)
     group by campus_id, week order by week`,
    [viewer.campusIds]
  );
  const series = (rows2: Record<string, unknown>[], campusId: unknown) =>
    rows2.filter((row) => row.campus_id === campusId).map((row) => Number(row.pct));
  return {
    campuses: rows.map((campus) => ({
      ...campus,
      attendance_weeks: series(attendanceWeeks, campus.id),
      test_weeks: series(testWeeks, campus.id),
    })),
    syncedAt: await lastSync(),
  };
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
  perfect: number;
  avg_exact: number | null;
  spread: number | null;
}

export async function campus(campusId: number, batch: string | null) {
  const params = [campusId, batch];
  const [{ now }] = await db().query(`select ${NOW}::text as now`);

  // Every test placed in the campus's subjects, section copies merged, with release dates
  // and totals over the students it was given to.
  const groups = (await db().query(
    `with ${SCOPE},
     stats as (
       select test_id, count(*)::int as eligible, count(*) filter (where submitted)::int as submitted,
              sum(pct) filter (where submitted) as pct_sum, max(pct) filter (where submitted) as top,
              sum(pct * pct) filter (where submitted) as pct_sq_sum,
              count(*) filter (where submitted and pct >= 99.5)::int as perfect
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
            round(max(st.top))::int as top_pct,
            coalesce(sum(st.perfect), 0)::int as perfect,
            (sum(st.pct_sum) / nullif(sum(st.submitted), 0))::float8 as avg_exact,
            sqrt(greatest(sum(st.pct_sq_sum) / nullif(sum(st.submitted), 0)
              - power(sum(st.pct_sum) / nullif(sum(st.submitted), 0), 2), 0))::float8 as spread
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
    .map(({ avg_exact, spread, ...group }) => ({
      ...group,
      status: statusOf(group.released_at, group.due_at, now),
      // Unusually high, uniform scores on an unproctored test (src/lib/integrity.ts).
      integrity: integrityOf({
        category: group.category,
        submitted: group.submitted,
        perfect: group.perfect,
        avg: avg_exact,
        spread,
      }),
    }))
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
  const weeks = new Map<
    string,
    { week: string; tests: number; submitted: number; eligible: number; pct: number }
  >();
  for (const test of out) {
    const day = new Date(`${test.released_at!.slice(0, 10)}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7)); // Monday
    const week = day.toISOString().slice(0, 10);
    const entry = weeks.get(week) ?? { week, tests: 0, submitted: 0, eligible: 0, pct: 0 };
    entry.tests += 1;
    entry.submitted += test.submitted;
    entry.eligible += test.eligible;
    entry.pct += (test.avg_pct ?? 0) * test.submitted;
    weeks.set(week, entry);
  }
  const timeline = [...weeks.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((week) => ({
      week: week.week,
      tests: week.tests,
      avg_pct: week.submitted ? Math.round(week.pct / week.submitted) : null,
      participation: week.eligible ? Math.round((100 * week.submitted) / week.eligible) : null,
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
  // Each student's marks on every Prime Mock Test that is out, and score on every AMCAT round,
  // for the per-test columns of the Students tab.
  const mockIds = subjectTests
    .filter((test) => test.status === 'completed' || test.status === 'live')
    .flatMap((test) => test.ids);
  const mockRows = mockIds.length
    ? await db().query(
        `with ${SCOPE}
         select r.username, res.test_id, res.submitted, res.marks, round(res.pct)::int as pct
         from res join roster r using (lms_user_id)
         where res.test_id = any($3::int[])`,
        [campusId, batch, mockIds]
      )
    : [];
  const keyOfTest = new Map(
    subjectTests.flatMap((test) => test.ids.map((id) => [id, test.ids.join(',')] as const))
  );
  const amcatRows = await db().query(
    `with ${SCOPE}
     select r.username, a.test_name, min(a.taken_at)::date::text as taken_on,
            round(avg((x->>'score')::numeric) filter (where x->>'score' ~ '^[0-9.]+$'))::int as score
     from amcat_sittings a join roster r using (lms_user_id)
     cross join lateral jsonb_array_elements(a.sections) x
     group by r.username, a.test_name`,
    params
  );
  const perStudent = new Map<
    string,
    {
      mocks: Record<string, { pct: number | null; marks: number | null; submitted: boolean }>;
      amcat_rounds: Record<string, { score: number | null; taken_on: string | null }>;
    }
  >();
  const entry = (username: string) => {
    let found = perStudent.get(username);
    if (!found) perStudent.set(username, (found = { mocks: {}, amcat_rounds: {} }));
    return found;
  };
  for (const row of mockRows) {
    const key = keyOfTest.get(Number(row.test_id));
    if (!key) continue;
    const mocks = entry(String(row.username)).mocks;
    // A student is in one section copy; keep the submitted one if both exist.
    if (mocks[key]?.submitted && !row.submitted) continue;
    mocks[key] = {
      pct: row.pct === null ? null : Number(row.pct),
      marks: row.marks === null ? null : Number(row.marks),
      submitted: Boolean(row.submitted),
    };
  }
  for (const row of amcatRows) {
    entry(String(row.username)).amcat_rounds[String(row.test_name)] = {
      score: row.score === null ? null : Number(row.score),
      taken_on: row.taken_on ? String(row.taken_on) : null,
    };
  }

  // The campus's cohorts: program and admission year, newest first.
  const batches = (
    await db()`
      select program, admission_year, count(*)::int as students from students
      where on_platform and campus_id = ${campusId} and admission_year is not null
        and program is not null
      group by program, admission_year
      order by admission_year desc, program`
  ).map((row) => ({
    key: `${row.program}:${row.admission_year}`,
    program: String(row.program),
    year: Number(row.admission_year),
    students: Number(row.students),
  }));

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
    students: students.map((student) => ({
      ...student,
      mocks: perStudent.get(String(student.username))?.mocks ?? {},
      amcat_rounds: perStudent.get(String(student.username))?.amcat_rounds ?? {},
    })),
    attendance: await attendance(campusId, batch),
    amcat: await amcatRounds(campusId, batch),
    exams: await internalExams(campusId, batch),
    delivery: await delivery(campusId, batch).catch((error) => {
      console.error('[assessments] delivery', error);
      return null;
    }),
    batches,
    now,
    syncedAt: await lastSync(),
  };
}

// PRIME coding domain delivery (scripts/sync-delivery.ts), for one campus and batch filter.
// Only verified classes count as delivered; durations under 1 minute or over 10 hours are
// left out as data errors and counted separately, and so are repeat submissions of a class
// (dlv_classes_counted leaves them out).
const DLV_FILTER = `($2::text is null or batch_year::text = $2 or program || ':' = $2
  or program || ':' || batch_year = $2)`;
const DLV_VALID = `minutes between 1 and 600`;

async function delivery(campusId: number, batch: string | null) {
  const [campus] = await db()`select code from campuses where id = ${campusId}`;
  const code = campus?.code ? String(campus.code).trim() : null;
  if (!code) return null;
  const params = [code, batch];
  const [summary] = await db().query(
    `select
       (select coalesce(sum(allocated_hours), 0)::int from dlv_targets where campus_code = $1 and ${DLV_FILTER}) as allocated,
       (select coalesce(sum(planned_hours), 0)::int from dlv_targets where campus_code = $1 and ${DLV_FILTER}) as planned,
       round(coalesce(sum(minutes) filter (where status = 'VERIFIED' and ${DLV_VALID}), 0) / 60.0)::int as delivered,
       round(coalesce(sum(minutes) filter (where status = 'PENDING VERIFICATION' and ${DLV_VALID}), 0) / 60.0)::int as pending,
       count(*) filter (where status = 'VERIFIED' and ${DLV_VALID})::int as classes,
       count(*) filter (where status = 'REJECTED')::int as rejected,
       count(*) filter (where status = 'VERIFIED' and not (${DLV_VALID}))::int as invalid,
       count(distinct trainer) filter (where status = 'VERIFIED')::int as trainer_count,
       round(100.0 * sum(present) filter (where status = 'VERIFIED') /
             nullif(sum(total) filter (where status = 'VERIFIED' and present is not null), 0))::int as attendance,
       max(class_date) filter (where status = 'VERIFIED')::text as last_class,
       (select count(*) from dlv_classes where campus_code = $1 and ${DLV_FILTER}
          and duplicate and status = 'VERIFIED')::int as duplicates
     from dlv_classes_counted where campus_code = $1 and ${DLV_FILTER}`,
    params
  );
  if (!summary.allocated && !summary.classes && !summary.pending) return null;
  const sections = await db().query(
    `with t as (
       select program, batch_year, coalesce(section, '') as section, sum(allocated_hours)::int as allocated,
              sum(planned_hours)::int as planned, sum(students)::int as students
       from dlv_targets where campus_code = $1 and ${DLV_FILTER} group by 1, 2, 3),
     d as (
       select program, batch_year, coalesce(section, '') as section,
              round(sum(minutes) filter (where status = 'VERIFIED' and ${DLV_VALID}) / 60.0)::int as delivered,
              round(sum(minutes) filter (where status = 'PENDING VERIFICATION' and ${DLV_VALID}) / 60.0)::int as pending,
              count(*) filter (where status = 'VERIFIED')::int as classes,
              max(class_date) filter (where status = 'VERIFIED')::text as last_class
       from dlv_classes_counted where campus_code = $1 and ${DLV_FILTER} group by 1, 2, 3)
     select coalesce(t.program, d.program) as program, coalesce(t.batch_year, d.batch_year) as batch_year,
            nullif(coalesce(t.section, d.section), '') as section, t.students,
            coalesce(t.allocated, 0) as allocated, coalesce(t.planned, 0) as planned,
            coalesce(d.delivered, 0) as delivered, coalesce(d.pending, 0) as pending,
            coalesce(d.classes, 0) as classes, d.last_class
     from t full join d using (program, batch_year, section)
     order by batch_year desc, program, section`,
    params
  );
  const tracked = await db().query(
    `select trainer as name,
            round(coalesce(sum(minutes) filter (where status = 'VERIFIED'), 0) / 60.0)::int as hours,
            round(coalesce(sum(minutes) filter (where status = 'PENDING VERIFICATION'), 0) / 60.0)::int as pending_hours,
            count(*) filter (where status = 'VERIFIED')::int as classes,
            round(100.0 * sum(present) filter (where status = 'VERIFIED') /
                  nullif(sum(total) filter (where status = 'VERIFIED' and present is not null), 0))::int as attendance,
            max(class_date) filter (where status = 'VERIFIED')::text as last_class
     from dlv_classes_counted where campus_code = $1 and ${DLV_FILTER} and ${DLV_VALID}
       and status in ('VERIFIED', 'PENDING VERIFICATION') and trainer is not null
     group by trainer order by hours desc`,
    params
  );
  // The same trainers' PRIME coding classes in the LMS time table, since the tracker's first
  // class here, for the batch of each session's students.
  const lms = await db().query(
    `select min(a.faculty) as name, count(*)::int as classes, round(sum(a.minutes) / 60.0)::int as hours
     from att_sessions a join students s on s.lms_user_id = a.first_student
     where a.campus_id = $3 and (${PRIME_CODING}) and a.minutes between 1 and 600 and a.faculty is not null
       and a.lecture_date >= (select min(class_date) from dlv_classes where campus_code = $1)
       and ${COHORT.replace(/admission_year|program/g, (column) => `s.${column}`)}
     group by a.faculty_id`,
    [code, batch, campusId]
  );
  const trainers = compareTrainers(tracked as TrackedTrainer[], lms as LmsTrainer[]);
  const weeks = await db().query(
    `select date_trunc('week', class_date)::date::text as week, round(sum(minutes) / 60.0)::int as hours
     from dlv_classes_counted where campus_code = $1 and ${DLV_FILTER} and status = 'VERIFIED' and ${DLV_VALID}
       and class_date < date_trunc('week', current_date)
     group by 1 order by 1`,
    params
  );
  // The syllabus of the curricula these batches follow, with hours taught on each topic.
  const topics = await db().query(
    `with cur as (
       select distinct t.curriculum, t.program from dlv_topics t
       where exists (select 1 from dlv_targets g where g.campus_code = $1 and ${DLV_FILTER.replace(/batch_year/g, 'g.batch_year').replace(/program/g, 'g.program')}
                     and g.program = t.program and g.batch_year = any(t.batch_years))),
     taught as (
       select curriculum, topic, round(sum(minutes) / 60.0, 1)::float8 as hours, count(*)::int as classes,
              min(class_date)::text as first_class, max(class_date)::text as last_class
       from dlv_classes_counted where campus_code = $1 and ${DLV_FILTER} and status = 'VERIFIED' and ${DLV_VALID}
       group by 1, 2)
     select t.curriculum, t.topic, t.topic_order, t.subtopics, coalesce(x.hours, 0) as hours,
            coalesce(x.classes, 0) as classes, x.first_class, x.last_class
     from dlv_topics t join cur using (curriculum, program)
     left join taught x on x.curriculum = t.curriculum and x.topic = t.topic
     order by t.curriculum, t.topic_order`,
    params
  );
  const [{ synced }] = await db()`
    select (select ran_at::text from sync_state where name = 'delivery') as synced`;
  return { ...summary, sections, trainers, weeks, topics, syncedAt: synced };
}

// PRIME subjects in attendance (named by hand in the LMS: "Prime Domain Coding", "Prime
// Aptitude", "Competitive Coding (Sunstone Prime Tech Domain)"...).
const PRIME_SUBJECT = `subject ~* '(^|[^a-z])prime([^a-z]|$)|competitive coding'`;
// The PRIME coding domain only ("Prime Domain Coding", "Priem Domain Coding", "Prime Tech
// Domain"…), not PRIME aptitude or communication.
const PRIME_CODING = `(subject ~* '(^|[^a-z])pri[mne]{2}([^a-z]|$)' and subject ~* 'domain|coding|tech'
  and subject !~* 'apti|comm') or subject ~* 'competitive coding'`;

interface TrackedTrainer {
  name: string;
  hours: number;
  pending_hours: number;
  classes: number;
  attendance: number | null;
  last_class: string | null;
}
interface LmsTrainer {
  name: string;
  hours: number;
  classes: number;
}
const nameTokens = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .split(/\s+/)
    .filter((token, index, all) => token && token !== all[index - 1]);
const titleCase = (name: string) =>
  name.trim().replace(/\S+/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());

/**
 * Tracker trainers with their hours in the LMS. Each system has its own spelling of a name, so
 * they match by full name, then by one name within the other ("Hansraj" / "Hansraj Athole"),
 * then by a first name only one trainer on each side has ("Ravi Panjiyar" / "Ravi Kumar").
 * LMS instructors with PRIME coding classes but nothing in the tracker are listed too.
 */
function compareTrainers(tracked: TrackedTrainer[], lms: LmsTrainer[]) {
  const pool = lms.map((row) => ({ ...row, tokens: nameTokens(String(row.name)), used: false }));
  const rows = tracked.map((row) => ({
    ...row,
    tokens: nameTokens(String(row.name)),
    match: null as (typeof pool)[number] | null,
  }));
  const rules: ((a: string[], b: string[]) => boolean)[] = [
    (a, b) => a.join(' ') === b.join(' '),
    (a, b) => a.every((token) => b.includes(token)) || b.every((token) => a.includes(token)),
    (a, b) =>
      a[0] === b[0] && rows.filter((row) => !row.match && row.tokens[0] === a[0]).length === 1,
  ];
  for (const rule of rules) {
    for (const row of rows) {
      if (row.match) continue;
      const candidates = pool.filter((entry) => !entry.used && rule(row.tokens, entry.tokens));
      if (candidates.length !== 1) continue;
      row.match = candidates[0];
      candidates[0].used = true;
    }
  }
  const lmsName = (entry: (typeof pool)[number]) => titleCase(String(entry.name));
  return [
    ...rows.map(({ tokens, match, ...row }) => ({
      ...row,
      in_tracker: true,
      lms_name: match && match.tokens.join(' ') !== tokens.join(' ') ? lmsName(match) : null,
      lms_hours: match ? Number(match.hours) : null,
      lms_classes: match ? Number(match.classes) : null,
    })),
    ...pool
      .filter((entry) => !entry.used && Number(entry.classes) >= 3)
      .map((entry) => ({
        name: lmsName(entry),
        hours: 0,
        pending_hours: 0,
        classes: 0,
        attendance: null as number | null,
        last_class: null as string | null,
        in_tracker: false,
        lms_name: null,
        lms_hours: Number(entry.hours),
        lms_classes: Number(entry.classes),
      })),
  ].sort(
    (a, b) =>
      Math.max(b.hours + b.pending_hours, b.lms_hours ?? 0) -
      Math.max(a.hours + a.pending_hours, a.lms_hours ?? 0)
  );
}

/** Class attendance for one campus (and batch): overall, PRIME, weekly, per subject and instructor. */
async function attendance(campusId: number, batch: string | null) {
  const params = [campusId, batch];
  const ROSTER = `roster as (
    select lms_user_id from students
    where on_platform and campus_id = $1 and ${COHORT})`;
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
     from att_student_week
     where lms_user_id in (select lms_user_id from roster)
       and week < date_trunc('week', current_date)::date
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
    where on_platform and campus_id = $1 and ${COHORT}),
  mk as (
    select m.*, e.subject, e.title, e.kind, e.exam_date, e.max_marks,
           ${EXAM_EVENT} as event,
           m.marks / nullif(e.max_marks, 0) * 100 as pct
    from exm_marks m join roster r using (lms_user_id)
    join exm_exams e on e.id = m.exam_id
    left join exm_examinations x on x.id = e.examination_id)`;

/** Internal exams (Midterms, End-term) and Mock PI / GD for one campus and batch. */
async function internalExams(campusId: number, batch: string | null) {
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
async function amcatRounds(campusId: number, batch: string | null) {
  const params = [campusId, batch];
  const BASE = `
    roster as (
      select lms_user_id, name, username from students
      where on_platform and campus_id = $1 and ${COHORT}),
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

async function test(campusId: number, batch: string | null, testIds: number[]) {
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
    from att_student_week
    where lms_user_id = ${person.lms_user_id} and week < date_trunc('week', current_date)::date
    order by week`;
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
 * For the students table and the 360° view: per student (by username) the viewer may see,
 * attendance, AMCAT sitting averages in date order (for the trend), PRIME test average and
 * counts, and the internal exam average (Midterms and End-term; not Mock PI / GD).
 */
export async function metrics(viewer: Viewer) {
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
       select test_id, section_id, release_at from lms_test_releases
       where visible and release_at <= ${NOW}),
     eligible as (
       select distinct d.test_id, ss.lms_user_id from done d join lms_section_students ss using (section_id)
       where ss.lms_user_id in (select lms_user_id from roster)),
     aw as (
       select lms_user_id, json_agg(round(100.0 * present / nullif(sessions, 0))::int order by week) as list
       from att_student_week
       where lms_user_id in (select lms_user_id from roster) and week >= current_date - 77
         and week < date_trunc('week', current_date)::date
       group by lms_user_id),
     scored as (
       select ss.lms_user_id, d.test_id, min(d.release_at) as released,
              round(max(tr.marks / nullif(coalesce(tr.max_marks, t.max_marks), 0) * 100))::int as pct
       from done d join lms_section_students ss using (section_id)
       join lms_tests t on t.id = d.test_id
       join lms_test_results tr on tr.test_id = d.test_id and tr.lms_user_id = ss.lms_user_id and tr.submitted
       where ss.lms_user_id in (select lms_user_id from roster)
       group by ss.lms_user_id, d.test_id),
     tt as (
       select lms_user_id, json_agg(pct order by released) as list from scored group by lms_user_id),
     ex as (
       select m.lms_user_id,
              round(avg(least(m.marks / nullif(e.max_marks, 0) * 100, 100)))::int as avg
       from exm_marks m join exm_exams e on e.id = m.exam_id
       where m.marks is not null and coalesce(e.kind, 'other') not in ('mock_pi', 'mock_gd')
         and m.lms_user_id in (select lms_user_id from roster)
       group by m.lms_user_id),
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
            am.list as amcat, tst.avg as test_avg, tst.submitted, tst.released,
            aw.list as attendance_weeks, tt.list as test_trend, ex.avg as exam_avg
     from roster r
     left join att using (lms_user_id) left join am using (lms_user_id) left join tst using (lms_user_id)
     left join aw using (lms_user_id) left join tt using (lms_user_id) left join ex using (lms_user_id)
     where att.lms_user_id is not null or am.lms_user_id is not null or tst.lms_user_id is not null
       or ex.lms_user_id is not null`,
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
    // "2025", a program "BCA:" or a cohort "BCA:2025" (program names: letters, dots, spaces).
    const rawBatch = params.get('batch');
    const batch = rawBatch && BATCH_FILTER.test(rawBatch) ? rawBatch : null;

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
