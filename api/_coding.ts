// Vertex's PRIME Coding Domain page (served by api/prime.ts on Vertex): AMCAT cycles and the
// LMS AMCAT mock tests, the placement pipeline, syllabus and class delivery from the delivery
// tracker, and cohort movement between AMCAT cycles.
//
// The per-student rows are saved once as a snapshot for everyone ('coding') and narrowed to the
// viewer's campuses on each request; the page works out its numbers from them, so the pass mark
// and the filters change without another request. Delivery comes from the tracker copy
// (dlv_*, read-only, synced by scripts/sync-delivery.ts) and is small enough to read each time.

import { type Viewer } from './_auth';
import { PROGRAM_RANK, db, together } from './_db';
import { scorePct } from './assessments';
import { snapshot, type WaitUntil } from './_snapshot';

/** AMCAT cycles: sittings are grouped by the window they were taken in. */
export const CYCLES = [
  { key: 'dec25', label: "Dec'25", from: '2025-07-01', to: '2026-04-01' },
  { key: 'may26', label: "May'26", from: '2026-04-01', to: '2026-08-01' },
  { key: 'dec26', label: "Dec'26", from: '2026-08-01', to: '2027-04-01' },
] as const;

/** AMCAT modules in each skill (as on the AMCAT dashboard). */
export const SKILLS = {
  comms: ['English Comprehension', 'WriteX Essay Writing'],
  aptitude: ['Quantitative Ability', 'Logical Ability'],
  domain: [
    'Automata',
    'Data Structures',
    'Web Development',
    'SQL',
    'Computer Science',
    'Cloud Computing',
  ],
} as const;

export interface CycleScores {
  /** Comms, aptitude and domain: the mean of the modules taken in that cycle. */
  c: number | null;
  a: number | null;
  d: number | null;
  /** Each module's score (the latest in the cycle). */
  m: Record<string, number>;
  /** Date of the last sitting in the cycle. */
  on: string;
}

export interface CodingStudent {
  slug: string;
  name: string;
  campusId: number | null;
  campus: string;
  program: string;
  year: number | null;
  /** LMS opportunity cohorts. */
  cohorts: string[];
  /** Centre of Excellence track (student_tracks), e.g. "DE Tech". */
  track: string | null;
  /** Best offer: 'full-time', 'internship', or null. */
  placed: 'full-time' | 'internship' | null;
  offers: { company: string | null; role: string | null; fullTime: boolean }[];
  pipeline: { eligible: number; applied: number; shortlisted: number; interviews: number };
  amcat: Record<string, CycleScores>;
  /** LMS "AMCAT Mock Test n": score % when submitted, null when released but not taken. */
  mocks: Record<string, number | null>;
  /** Problems solved on coding platforms (LeetCode, GFG, HackerRank, Codeforces, CodeChef). */
  solved: number | null;
  /** PRIME coding attendance, %. */
  attendance: number | null;
}

const num = (value: unknown) => (value == null || value === '' ? null : Number(value));
/** One decimal: a 44.5 average is not a pass at 45. */
const mean = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

const cycleOf = (date: string) =>
  CYCLES.find((cycle) => date >= cycle.from && date < cycle.to)?.key ?? null;

export async function codingRows(): Promise<{ students: CodingStudent[]; syncedAt: string }> {
  const [students, offers, pipeline, sittings, mocks, solved, attendance] = await together([
    db()`
      select s.lms_user_id, s.username, s.name, s.campus_id, s.campus, s.program, s.admission_year,
        (select coalesce(array_agg(c.cohort order by c.cohort_id), '{}') from student_cohorts c
          where c.lms_user_id = s.lms_user_id) as cohorts,
        (select t.track from student_tracks t where t.lms_user_id = s.lms_user_id) as track
      from students s where s.on_platform`,
    db()`
      select lms_user_id, company, designation, full_time from placements
      where not withdrawn order by selected_on desc`,
    db()`select * from placement_pipeline`,
    db()`
      select lms_user_id, taken_at::date::text as day, sections from amcat_sittings
      where taken_at is not null order by taken_at`,
    // The LMS AMCAT mock tests (Prime Domain Coding): every student they were released to.
    db().query(`
      with mock as (
        select t.id, (regexp_match(t.name, '(?i)amcat\\s*mock\\s*test\\s*(\\d+)'))[1]::int as n
        from lms_tests t where t.name ~* 'amcat\\s*mock\\s*test\\s*\\d'),
      given as (
        select distinct m.n, m.id, ss.lms_user_id from mock m
        join lms_test_releases r on r.test_id = m.id and r.visible and r.release_at <= now()
        join lms_section_students ss on ss.section_id = r.section_id)
      select g.lms_user_id, g.n,
             round(max(${scorePct('tr', 't')}) filter (where tr.submitted))::int as pct
      from given g join lms_tests t on t.id = g.id
      left join lms_test_results tr on tr.test_id = g.id and tr.lms_user_id = g.lms_user_id
      group by 1, 2`),
    db()`
      select s.lms_user_id, sum((ps.summary->>'value')::int)::int as solved
      from students s
      cross join lateral (values ('leetcode', s.leetcode), ('geeksforgeeks', s.geeksforgeeks),
        ('hackerrank', s.hackerrank), ('codeforces', s.codeforces), ('codechef', s.codechef)) h(platform, handle)
      join platform_stats ps on ps.platform = h.platform and ps.handle = h.handle
      where s.on_platform and h.handle <> '' and not (h.platform = any(s.invalid_handles))
        and ps.summary->>'value' ~ '^[0-9]+$'
      group by s.lms_user_id`,
    db().query(`
      select lms_user_id, round(100.0 * sum(present) / nullif(sum(sessions), 0))::int as pct
      from att_student_subject
      where (subject ~* '(^|[^a-z])pri[mne]{2}([^a-z]|$)' and subject ~* 'domain|coding|tech'
             and subject !~* 'apti|comm') or subject ~* 'competitive coding'
      group by lms_user_id`),
  ]);

  const byUser = <T>(rows: Record<string, unknown>[], make: (row: Record<string, any>) => T) => {
    const map = new Map<number, T[]>();
    for (const row of rows) {
      const id = Number(row.lms_user_id);
      map.set(id, [...(map.get(id) ?? []), make(row)]);
    }
    return map;
  };
  const offersBy = byUser(offers, (row) => ({
    company: row.company as string | null,
    role: row.designation as string | null,
    fullTime: Boolean(row.full_time),
  }));
  const pipelineBy = new Map(pipeline.map((row) => [Number(row.lms_user_id), row]));
  const solvedBy = new Map(solved.map((row) => [Number(row.lms_user_id), num(row.solved)]));
  const attendanceBy = new Map(attendance.map((row) => [Number(row.lms_user_id), num(row.pct)]));
  const mocksBy = new Map<number, Record<string, number | null>>();
  for (const row of mocks) {
    const id = Number(row.lms_user_id);
    const entry = mocksBy.get(id) ?? {};
    entry[String(row.n)] = num(row.pct);
    mocksBy.set(id, entry);
  }

  // Each student's latest score in each module within each cycle (sittings come oldest first).
  const amcatBy = new Map<number, Record<string, CycleScores>>();
  for (const row of sittings) {
    const cycle = cycleOf(String(row.day));
    if (!cycle) continue;
    const id = Number(row.lms_user_id);
    const cycles = amcatBy.get(id) ?? {};
    const entry = (cycles[cycle] ??= { c: null, a: null, d: null, m: {}, on: String(row.day) });
    entry.on = String(row.day);
    for (const section of (row.sections as { name?: string; score?: unknown }[]) ?? []) {
      const score = Number(section?.score);
      if (section?.name && section.score != null && Number.isFinite(score)) {
        entry.m[section.name] = Math.round(score);
      }
    }
    amcatBy.set(id, cycles);
  }
  for (const cycles of amcatBy.values()) {
    for (const entry of Object.values(cycles)) {
      const skill = (modules: readonly string[]) =>
        mean(modules.filter((name) => name in entry.m).map((name) => entry.m[name]));
      entry.c = skill(SKILLS.comms);
      entry.a = skill(SKILLS.aptitude);
      entry.d = skill(SKILLS.domain);
    }
  }

  return {
    students: students.map((row) => {
      const id = Number(row.lms_user_id);
      const own = offersBy.get(id) ?? [];
      const flow = pipelineBy.get(id);
      return {
        slug: String(row.username),
        name: String(row.name),
        campusId: row.campus_id == null ? null : Number(row.campus_id),
        campus: String(row.campus ?? ''),
        program: String(row.program ?? ''),
        year: num(row.admission_year),
        cohorts: (row.cohorts as string[]) ?? [],
        track: (row.track as string | null) ?? null,
        placed: own.some((offer) => offer.fullTime)
          ? 'full-time'
          : own.length
            ? 'internship'
            : null,
        offers: own,
        pipeline: {
          eligible: Number(flow?.eligible ?? 0),
          applied: Number(flow?.applied ?? 0),
          shortlisted: Number(flow?.shortlisted ?? 0),
          interviews: Number(flow?.interviews ?? 0),
        },
        amcat: amcatBy.get(id) ?? {},
        mocks: mocksBy.get(id) ?? {},
        solved: solvedBy.get(id) ?? null,
        attendance: attendanceBy.get(id) ?? null,
      };
    }),
    syncedAt: new Date().toISOString(),
  };
}

export const codingRowsSnapshot = (context?: WaitUntil) => snapshot('coding', codingRows, context);

// --- Delivery (the tracker copy) ---------------------------------------------------------

/** As in api/assessments.ts: only classes of 1 minute to 10 hours count. */
const VALID = `minutes between 1 and 600`;

/** Every section's targets and classes, topic by topic, and each trainer's classes. */
export async function deliveryReport(campusIds: number[] | null) {
  const codes = (
    await db().query(
      `select code from campuses where code is not null and ($1::int[] is null or id = any($1::int[]))`,
      [campusIds]
    )
  ).map((row) => String(row.code).trim());
  const [sections, taught, topics, trainers, synced] = await together([
    db().query(
      `with t as (
         select campus_code, program, batch_year, coalesce(section, '') as section,
                sum(students)::int as students, sum(planned_hours)::int as planned,
                sum(allocated_hours)::int as allocated
         from dlv_targets where campus_code = any($1) group by 1, 2, 3, 4),
       d as (
         select campus_code, program, batch_year, coalesce(section, '') as section,
                count(*) filter (where status = 'VERIFIED' and ${VALID})::int as verified,
                count(*) filter (where status = 'PENDING VERIFICATION')::int as pending,
                count(*) filter (where status = 'REJECTED')::int as rejected,
                round(coalesce(sum(minutes) filter (where status = 'VERIFIED' and ${VALID}), 0) / 60.0, 1)::float8 as verified_hours,
                round(coalesce(sum(minutes) filter (where status = 'PENDING VERIFICATION' and ${VALID}), 0) / 60.0, 1)::float8 as pending_hours,
                round(coalesce(sum(minutes) filter (where status = 'REJECTED' and ${VALID}), 0) / 60.0, 1)::float8 as rejected_hours,
                round(avg(minutes) filter (where status = 'VERIFIED' and ${VALID}))::int as class_minutes,
                round(100.0 * sum(present) filter (where status = 'VERIFIED') /
                      nullif(sum(total) filter (where status = 'VERIFIED' and present is not null), 0))::int as attendance,
                max(class_date) filter (where status = 'VERIFIED')::text as last_class,
                string_agg(distinct trainer, ', ') as trainers
         from dlv_classes_counted where campus_code = any($1) group by 1, 2, 3, 4)
       select coalesce(t.campus_code, d.campus_code) as campus_code,
              coalesce(t.program, d.program) as program,
              coalesce(t.batch_year, d.batch_year) as batch_year,
              nullif(coalesce(t.section, d.section), '') as section,
              t.students, coalesce(t.planned, 0) as planned, coalesce(t.allocated, 0) as allocated,
              coalesce(d.verified, 0) as verified, coalesce(d.pending, 0) as pending,
              coalesce(d.rejected, 0) as rejected, coalesce(d.verified_hours, 0) as verified_hours,
              coalesce(d.pending_hours, 0) as pending_hours, coalesce(d.rejected_hours, 0) as rejected_hours,
              d.class_minutes, d.attendance, d.last_class, d.trainers
       from t full join d using (campus_code, program, batch_year, section)
       order by 1, ${PROGRAM_RANK('coalesce(t.program, d.program)')}, 3, 4`,
      [codes]
    ),
    db().query(
      `select campus_code, program, batch_year, section, curriculum, topic,
              count(*) filter (where status = 'VERIFIED' and ${VALID})::int as verified,
              count(*) filter (where status = 'PENDING VERIFICATION')::int as pending,
              count(*) filter (where status = 'REJECTED')::int as rejected,
              round(coalesce(sum(minutes) filter (where status = 'VERIFIED' and ${VALID}), 0) / 60.0, 1)::float8 as hours,
              count(distinct subtopic) filter (where status = 'VERIFIED' and ${VALID})::int as subtopics
       from dlv_classes_counted where campus_code = any($1) and topic is not null
       group by 1, 2, 3, 4, 5, 6`,
      [codes]
    ),
    db()`select curriculum, program, batch_years, topic, topic_order, subtopics from dlv_topics
         order by curriculum, topic_order`,
    db().query(
      `select trainer, campus_code, program, batch_year, section,
              count(*) filter (where status = 'VERIFIED' and ${VALID})::int as verified,
              count(*) filter (where status = 'PENDING VERIFICATION')::int as pending,
              count(*) filter (where status = 'REJECTED')::int as rejected,
              round(coalesce(sum(minutes) filter (where status = 'VERIFIED' and ${VALID}), 0) / 60.0, 1)::float8 as hours,
              max(class_date) filter (where status <> 'REJECTED')::text as last_logged
       from dlv_classes_counted where campus_code = any($1) and trainer is not null
       group by 1, 2, 3, 4, 5`,
      [codes]
    ),
    db()`select ran_at::text as ran_at from sync_state where name = 'delivery'`,
  ]);
  return {
    sections,
    taught,
    topics: topics.map((row) => ({
      ...row,
      batch_years: ((row.batch_years as number[]) ?? []).map(Number),
    })),
    trainers,
    syncedAt: synced[0] ? String(synced[0].ran_at) : null,
  };
}

/** The PRIME coding programs: the page leaves out anyone else (a few Diploma students). */
const CODING_PROGRAMS = new Set(['B.Tech', 'BE', 'BCA', 'MCA']);

/** The saved rows narrowed to the campuses a viewer may see (and one campus if asked). */
export function narrowStudents(
  students: CodingStudent[],
  viewer: Viewer,
  campusId: number | null
): CodingStudent[] {
  return students.filter(
    (row) =>
      CODING_PROGRAMS.has(row.program) &&
      (viewer.campusIds === null ||
        (row.campusId !== null && viewer.campusIds.includes(row.campusId))) &&
      (campusId === null || row.campusId === campusId)
  );
}
