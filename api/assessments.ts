// PRIME domain assessments (copied from the LMS by `npm run db:sync-assessments`). Staff only,
// and campus staff only for their campuses.
//
//   GET /api/assessments?view=campuses                    every campus at a glance
//   GET /api/assessments?view=campus&campus=ID[&batch=Y]  subjects, syllabus, every test
//   GET /api/assessments?view=test&campus=ID&test=ID,ID[&batch=Y]  each student's marks
//                                                     (a test's section copies together)
//   GET /api/assessments?view=student&s=username          one student's tests and AMCAT

import { type Viewer, json, seesCampus, sessionViewer } from './_auth';
import { db } from './_db';

export const config = { runtime: 'edge' };

const int = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : null);

// For one campus (and optionally one batch): its students, the sections they are in, the
// tests released to those sections, and each student's result on each of those tests.
// $1 = campus id, $2 = admission year or null.
const SCOPE = `
  roster as (
    select lms_user_id, name, username, admission_year, program
    from students where on_platform and campus_id = $1 and ($2::int is null or admission_year = $2)),
  sec as (
    select ss.section_id, ss.lms_user_id from lms_section_students ss join roster using (lms_user_id)),
  rel as (
    select r.* from lms_test_releases r where r.section_id in (select section_id from sec)),
  eligible as (
    select distinct rel.test_id, sec.lms_user_id from rel join sec using (section_id)),
  res as (
    select e.test_id, e.lms_user_id, tr.marks, tr.submitted, tr.attempts, tr.submitted_at,
           coalesce(tr.max_marks, t.max_marks) as max_marks
    from eligible e
    join lms_tests t on t.id = e.test_id
    left join lms_test_results tr on tr.test_id = e.test_id and tr.lms_user_id = e.lms_user_id)`;

const PERCENT = `(res.marks / nullif(res.max_marks, 0) * 100)`;

async function lastSync() {
  const [row] =
    await db()`select ran_at::text as ran_at from sync_state where name = 'assessments'`;
  return row ? String(row.ran_at) : null;
}

async function campuses(viewer: Viewer) {
  const rows = await db().query(
    `with roster as (
       select lms_user_id, campus_id, campus from students
       where on_platform and campus_id is not null and ($1::int[] is null or campus_id = any($1::int[]))),
     sec as (select ss.section_id, r.lms_user_id, r.campus_id from lms_section_students ss join roster r using (lms_user_id)),
     eligible as (
       select distinct r.test_id, sec.lms_user_id, sec.campus_id
       from lms_test_releases r join sec using (section_id)),
     res as (
       select e.campus_id, e.test_id, e.lms_user_id, tr.submitted,
              lower(trim(t.name)) || '|' || coalesce(t.max_marks::text, '') as test_key,
              tr.marks / nullif(coalesce(tr.max_marks, t.max_marks), 0) * 100 as pct
       from eligible e join lms_tests t on t.id = e.test_id
       left join lms_test_results tr on tr.test_id = e.test_id and tr.lms_user_id = e.lms_user_id),
     last_test as (
       select sec.campus_id, max(r.release_at) as at
       from lms_test_releases r join sec using (section_id) group by sec.campus_id)
     select c.campus_id as id, c.campus as name, count(distinct c.lms_user_id)::int as students,
       count(distinct res.lms_user_id)::int as in_prime,
       count(distinct res.test_key)::int as tests,
       count(*) filter (where res.submitted)::int as submissions,
       count(res.test_id)::int as expected,
       round(avg(res.pct) filter (where res.submitted))::int as avg_pct,
       (select at::text from last_test l where l.campus_id = c.campus_id) as last_test_at
     from roster c left join res on res.lms_user_id = c.lms_user_id and res.campus_id = c.campus_id
     group by c.campus_id, c.campus
     order by tests desc, c.campus`,
    [viewer.campusIds]
  );
  return { campuses: rows, syncedAt: await lastSync() };
}

interface SubjectRow {
  id: number;
  name: string;
  modules: number;
  lectures: number;
  students: number;
  tests: number;
  modules_list: { id: number; name: string; started: boolean; tests: number }[];
}

/**
 * The LMS keeps a copy of a subject (and its modules) for each group of sections. A campus
 * sees one "Prime Domain Coding": copies with the same name are merged, their modules matched
 * by name, and a module counts as started when any copy has a test released from it.
 */
function mergeSubjects(rows: SubjectRow[], tests: { ids: number[] }[]) {
  const subjects = new Map<string, SubjectRow & { order: Map<string, number> }>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    let subject = subjects.get(key);
    if (!subject) {
      subject = { ...row, students: 0, modules_list: [], order: new Map() };
      subjects.set(key, subject);
    }
    subject.students += row.students;
    subject.lectures = Math.max(subject.lectures, row.lectures);
    row.modules_list.forEach((module, index) => {
      const moduleKey = module.name.trim().toLowerCase();
      const existing = subject.modules_list.find(
        (candidate) => candidate.name.trim().toLowerCase() === moduleKey
      );
      if (existing) {
        existing.started ||= module.started;
        existing.tests += module.tests;
        subject.order.set(moduleKey, Math.min(subject.order.get(moduleKey) ?? index, index));
      } else {
        subject.modules_list.push({ ...module });
        subject.order.set(moduleKey, index);
      }
    });
  }
  return [...subjects.values()].map(({ order, ...subject }) => ({
    ...subject,
    modules: subject.modules_list.length,
    // Tests are grouped across section copies the same way in the tests list.
    tests: subjects.size === 1 ? tests.length : subject.tests,
    modules_list: subject.modules_list.sort(
      (a, b) =>
        (order.get(a.name.trim().toLowerCase()) ?? 0) -
        (order.get(b.name.trim().toLowerCase()) ?? 0)
    ),
  }));
}

async function campus(campusId: number, batch: number | null) {
  const params = [campusId, batch];
  const [summary] = await db().query(
    `with ${SCOPE}
     select (select count(*) from roster)::int as students,
            (select count(distinct lms_user_id) from sec)::int as in_prime,
            count(distinct (select lower(trim(name)) || '|' || coalesce(max_marks::text, '') from lms_tests where id = res.test_id))::int as tests,
            count(*) filter (where res.submitted)::int as submissions,
            count(*)::int as expected,
            round(avg(${PERCENT}) filter (where res.submitted))::int as avg_pct
     from res`,
    params
  );
  // The LMS makes a copy of a test for each section it is given to; one campus sees them as
  // one test, so copies with the same name and marks are grouped (their ids listed).
  const tests = await db().query(
    `with ${SCOPE}
     select array_agg(distinct t.id order by t.id) as ids, min(t.name) as name,
            min(t.category) as category, t.max_marks, max(t.minutes) as minutes,
            (select min(release_at)::text from rel where rel.test_id = any(array_agg(t.id))) as released_at,
            (select max(due_at)::text from rel where rel.test_id = any(array_agg(t.id))) as due_at,
            (select string_agg(distinct m.name, ', ') from rel join lms_modules m on m.id = rel.module_id
              where rel.test_id = any(array_agg(t.id))) as module,
            count(*)::int as eligible,
            count(*) filter (where res.submitted)::int as submitted,
            round(avg(${PERCENT}) filter (where res.submitted))::int as avg_pct,
            round(max(${PERCENT}) filter (where res.submitted))::int as top_pct
     from res join lms_tests t on t.id = res.test_id
     group by lower(trim(t.name)), t.max_marks
     order by released_at desc nulls last, name`,
    params
  );
  const subjects = await db().query(
    `with ${SCOPE},
     course_students as (
       select rel.course_id, count(distinct sec.lms_user_id)::int as students
       from rel join sec using (section_id) group by rel.course_id)
     select c.id, c.name, c.modules, c.lectures, cs.students,
            (select count(distinct test_id) from rel where rel.course_id = c.id)::int as tests,
            coalesce((select json_agg(json_build_object(
                        'id', m.id, 'name', m.name,
                        'started', exists (select 1 from rel where rel.module_id = m.id),
                        'tests', (select count(distinct test_id) from rel where rel.module_id = m.id))
                      order by m.position nulls last, m.id)
                      from lms_modules m where m.course_id = c.id), '[]') as modules_list
     from lms_courses c join course_students cs on cs.course_id = c.id
     order by cs.students desc`,
    params
  );
  const batches = (
    await db()`
      select distinct admission_year from students
      where on_platform and campus_id = ${campusId} and admission_year is not null
      order by admission_year desc`
  ).map((row) => Number(row.admission_year));
  return {
    summary,
    tests,
    subjects: mergeSubjects(subjects as SubjectRow[], tests as { ids: number[] }[]),
    batches,
    syncedAt: await lastSync(),
  };
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
            res.attempts, res.submitted_at::text as submitted_at,
            round(${PERCENT})::int as pct
     from res join roster r using (lms_user_id)
     where res.test_id = any($3::int[])
     order by res.submitted desc nulls last, res.marks desc nulls last, r.name`,
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
  const tests = await db()`
    with mine as (
      select distinct r.test_id, r.course_id, r.module_id, r.release_at
      from lms_test_releases r
      join lms_section_students ss on ss.section_id = r.section_id
      where ss.lms_user_id = ${person.lms_user_id}),
    classmates as (
      select r.test_id, ss.lms_user_id from lms_test_releases r
      join lms_section_students ss on ss.section_id = r.section_id
      where r.test_id in (select test_id from mine))
    select t.id, t.name, t.category, coalesce(tr.max_marks, t.max_marks) as max_marks,
           min(mine.release_at)::text as released_at,
           (select string_agg(distinct m.name, ', ') from lms_modules m
             where m.id in (select module_id from mine x where x.test_id = t.id)) as module,
           tr.marks, coalesce(tr.submitted, false) as submitted, tr.attempts,
           tr.submitted_at::text as submitted_at,
           round(tr.marks / nullif(coalesce(tr.max_marks, t.max_marks), 0) * 100)::int as pct,
           (select round(avg(o.marks / nullif(coalesce(o.max_marks, t.max_marks), 0) * 100))::int
              from lms_test_results o
              where o.test_id = t.id and o.submitted
                and o.lms_user_id in (select lms_user_id from classmates c where c.test_id = t.id)) as class_avg_pct
    from mine join lms_tests t on t.id = mine.test_id
    left join lms_test_results tr on tr.test_id = t.id and tr.lms_user_id = ${person.lms_user_id}
    group by t.id, tr.max_marks, tr.marks, tr.submitted, tr.attempts, tr.submitted_at
    order by released_at desc nulls last`;
  const amcat = await db()`
    select id, test_name, taken_at::text as taken_at, status, sections
    from amcat_sittings where lms_user_id = ${person.lms_user_id}
    order by taken_at desc nulls last`;
  return { tests, amcat, syncedAt: await lastSync() };
}

export default async function handler(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL) return json(404, { error: 'No database configured' });
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Login required' });

  const params = new URL(request.url).searchParams;
  const view = params.get('view');
  try {
    if (view === 'campuses') return json(200, await campuses(viewer));
    if (view === 'student') {
      const result = await student(viewer, params.get('s') ?? '');
      return result ? json(200, result) : json(404, { error: 'Student not found' });
    }

    const campusId = int(params.get('campus'));
    if (campusId === null) return json(400, { error: 'Choose a campus' });
    if (!seesCampus(viewer, campusId))
      return json(403, { error: 'You do not have access to this campus' });
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
