// Converge's PRIME Domain page: every PRIME domain subject (the MBA domains and the BBA career
// tracks) at each campus and batch — its tests and assignments, the hours planned and taught,
// AMCAT — and how PRIME relates to placements. See api/prime.ts.
//
// Subjects come from the LMS copy made by scripts/sync-assessments.ts (tests, results, grading),
// hours from scripts/sync-attendance.ts (class sessions), placements from
// scripts/sync-placements.ts (offers, and the whole school for the opt-in comparison).

import { type Viewer } from './_auth';
import { db, together } from './_db';
import { scorePct } from './assessments';

const NOW = `(now() at time zone 'Asia/Kolkata')`;

/** Planned hours per LMS credit, when HQ has not set them: the usual 15 contact hours. */
export const HOURS_PER_CREDIT = 15;

/** One name per subject, whatever its spelling in the LMS. */
const SUBJECT = (column: string) => `case
  when lower(trim(${column})) in ('prime domain', 'prime domains')
    then 'PRIME Domain (subject not named in the LMS)'
  when ${column} ~* 'career[[:space:]]*track' then 'Business Development Career Track'
  when ${column} ~* 'trainee' then 'Management Trainee Program'
  when ${column} ~* 'boot[[:space:]]*camp' then 'Prime Domain Boot Camp'
  when ${column} ~* 'revenue' then 'Revenue Generation Prime Domain'
  when ${column} ~* 'sales' then 'Sales and Marketing Prime Domain'
  when ${column} ~* 'finance' then 'Finance Prime Domain'
  when ${column} ~* '(^|[^a-z])hr([^a-z]|$)' then 'HR Prime Domain'
  when ${column} ~* '(^|[^a-z])it([^a-z]|$)' then 'IT Prime Domain'
  when ${column} ~* 'operation' then 'Operations Prime Domain'
  else initcap(trim(${column})) end`;

/** PRIME domain subjects; not communication and aptitude (ELQ), not coding. */
const IS_DOMAIN = (column: string) =>
  `(${column} ~* 'prime[[:space:]]*domain|career[[:space:]]*track|management[[:space:]]*trainee'
    and ${column} !~* 'coding')`;

const KEY = 'campus_id, campus, program, admission_year, subject';

export interface SubjectRow {
  campus_id: number;
  campus: string;
  program: string;
  admission_year: number;
  subject: string;
  students: number;
  /** Tests and assignments in the subject (by name, across its section copies). */
  created: number;
  /** Released to students so far. */
  published: number;
  /** Student × released test pairs, and how many were submitted and graded. */
  assigned: number;
  attempted: number;
  graded: number;
  avg_score: number | null;
  modules: number;
  modules_started: number;
  attendance: number | null;
  credits: number | null;
  sections: number;
  classes: number;
  total_hours: number | null;
  hours_per_section: number | null;
  trainers: string | null;
  last_class: string | null;
}

export interface AmcatRow {
  campus_id: number;
  campus: string;
  program: string;
  admission_year: number;
  students: number;
  with_sitting: number;
  sittings: number;
  latest_avg: number | null;
  sections: Record<string, number> | null;
}

/** Per campus, program, batch and subject, for everyone (narrowed per viewer by the caller). */
export async function primeRows(): Promise<{ subjects: SubjectRow[]; amcat: AmcatRow[] }> {
  const subjectsQuery = db().query(
    `with roster as (
       select lms_user_id, campus_id, campus, program, admission_year from students
       where on_platform and campus_id is not null and admission_year is not null),
     course as (
       select id, credits, ${SUBJECT('name')} as subject from lms_courses where ${IS_DOMAIN('name')}),
     enrol as (
       select distinct r.lms_user_id, r.campus_id, r.campus, r.program, r.admission_year,
              c.subject, c.id as course_id, cs.section_id
       from course c
       join lms_course_sections cs on cs.course_id = c.id
       join lms_section_students ss on ss.section_id = cs.section_id
       join roster r on r.lms_user_id = ss.lms_user_id),
     grp as (
       select ${KEY}, count(distinct lms_user_id)::int as students
       from enrol group by ${KEY}),
     grp_course as (select distinct ${KEY}, course_id from enrol),
     made as (
       select g.campus_id, g.program, g.admission_year, g.subject,
              count(distinct lower(t.name))::int as created, max(c.credits)::int as credits
       from grp_course g
       join course c on c.id = g.course_id
       left join lms_test_placements p on p.course_id = g.course_id
       left join lms_tests t on t.id = p.test_id
       group by 1, 2, 3, 4),
     mods as (
       select g.campus_id, g.program, g.admission_year, g.subject,
              count(distinct lower(m.name))::int as modules
       from grp_course g join lms_modules m on m.course_id = g.course_id
       group by 1, 2, 3, 4),
     assigned as (
       select e.campus_id, e.program, e.admission_year, e.subject, e.lms_user_id, r.test_id,
              r.course_id
       from enrol e
       join lms_test_releases r on r.section_id = e.section_id and r.course_id = e.course_id
       where r.visible and r.release_at <= ${NOW}),
     work as (
       select a.campus_id, a.program, a.admission_year, a.subject,
              count(distinct lower(t.name))::int as published,
              count(distinct (a.lms_user_id, a.test_id))::int as assigned,
              count(distinct (a.lms_user_id, a.test_id)) filter (where tr.submitted)::int as attempted,
              count(distinct (a.lms_user_id, a.test_id))
                filter (where tr.submitted and coalesce(tr.graded, tr.marks is not null))::int as graded,
              round(avg(${scorePct('tr', 't')})
                    filter (where tr.submitted))::int as avg_score,
              count(distinct lower(m.name))::int as modules_started
       from assigned a
       join lms_tests t on t.id = a.test_id
       left join lms_test_results tr on tr.test_id = a.test_id and tr.lms_user_id = a.lms_user_id
       left join lms_test_placements p on p.test_id = a.test_id and p.course_id = a.course_id
       left join lms_modules m on m.id = p.module_id
       group by 1, 2, 3, 4),
     att as (
       select r.campus_id, r.program, r.admission_year, ${SUBJECT('a.subject')} as subject,
              round(100.0 * sum(a.present) / nullif(sum(a.sessions), 0))::int as attendance
       from att_student_subject a join roster r on r.lms_user_id = a.lms_user_id
       where ${IS_DOMAIN('a.subject')}
       group by 1, 2, 3, 4),
     slots as (
       select r.campus_id, r.campus, r.program, r.admission_year, ${SUBJECT('s.subject')} as subject,
              coalesce(s.section_id, 0) as section_id, s.lecture_date, s.start_time,
              max(coalesce(s.minutes, 60)) as minutes, min(s.faculty) as faculty
       from att_sessions s join roster r on r.lms_user_id = s.first_student
       where ${IS_DOMAIN('s.subject')}
       group by 1, 2, 3, 4, 5, 6, 7, 8),
     taught as (
       select ${KEY}, count(distinct section_id)::int as sections, count(*)::int as classes,
              round(sum(minutes) / 60.0, 1)::float as total_hours,
              round(sum(minutes) / 60.0 / greatest(count(distinct section_id), 1), 1)::float
                as hours_per_section,
              string_agg(distinct faculty, ', ') as trainers, max(lecture_date)::text as last_class
       from slots group by ${KEY}),
     keys as (select ${KEY} from grp union select ${KEY} from taught)
     select k.campus_id, k.campus, k.program, k.admission_year, k.subject,
            coalesce(g.students, 0) as students, coalesce(made.created, 0) as created,
            coalesce(work.published, 0) as published, coalesce(work.assigned, 0) as assigned,
            coalesce(work.attempted, 0) as attempted, coalesce(work.graded, 0) as graded,
            work.avg_score, coalesce(mods.modules, 0) as modules,
            coalesce(work.modules_started, 0) as modules_started, att.attendance, made.credits,
            coalesce(taught.sections, 0) as sections, coalesce(taught.classes, 0) as classes,
            taught.total_hours, taught.hours_per_section, taught.trainers, taught.last_class
     from keys k
     left join grp g using (${KEY})
     left join taught using (${KEY})
     left join made using (campus_id, program, admission_year, subject)
     left join mods using (campus_id, program, admission_year, subject)
     left join work using (campus_id, program, admission_year, subject)
     left join att using (campus_id, program, admission_year, subject)
     order by k.campus, k.program, k.admission_year, k.subject`
  );
  const amcatQuery = db().query(
    `with roster as (
       select lms_user_id, campus_id, campus, program, admission_year from students
       where on_platform and campus_id is not null and admission_year is not null),
     latest as (
       select distinct on (a.lms_user_id) a.lms_user_id, a.sections
       from amcat_sittings a join roster r using (lms_user_id)
       where a.sections is not null and jsonb_array_length(a.sections) > 0
       order by a.lms_user_id, a.taken_at desc nulls last),
     parts as (
       select l.lms_user_id, x->>'name' as section, (x->>'score')::numeric as score
       from latest l cross join lateral jsonb_array_elements(l.sections) x
       where x->>'score' ~ '^[0-9.]+$'),
     per_student as (
       select lms_user_id, avg(score) as score from parts group by lms_user_id),
     counts as (
       select r.campus_id, r.campus, r.program, r.admission_year,
              count(distinct r.lms_user_id)::int as students,
              count(distinct a.lms_user_id)::int as with_sitting, count(a.id)::int as sittings
       from roster r left join amcat_sittings a on a.lms_user_id = r.lms_user_id
       group by 1, 2, 3, 4),
     scores as (
       select r.campus_id, r.program, r.admission_year,
              round(avg(p.score))::int as latest_avg
       from per_student p join roster r using (lms_user_id) group by 1, 2, 3),
     sections as (
       select campus_id, program, admission_year, jsonb_object_agg(section, avg) as sections
       from (select r.campus_id, r.program, r.admission_year, p.section,
                    round(avg(p.score))::int as avg
             from parts p join roster r using (lms_user_id) group by 1, 2, 3, 4) s
       group by 1, 2, 3)
     select c.*, s.latest_avg, x.sections
     from counts c
     left join scores s using (campus_id, program, admission_year)
     left join sections x using (campus_id, program, admission_year)
     order by c.campus, c.program, c.admission_year`
  );
  const [subjects, amcat] = await together([subjectsQuery, amcatQuery]);
  return {
    subjects: subjects.map((row) => ({
      ...row,
      admission_year: Number(row.admission_year),
      campus_id: Number(row.campus_id),
    })) as SubjectRow[],
    amcat: amcat.map((row) => ({
      ...row,
      admission_year: Number(row.admission_year),
      campus_id: Number(row.campus_id),
    })) as AmcatRow[],
  };
}

export interface PlannedHours {
  campus_id: number;
  program: string;
  admission_year: number;
  subject: string;
  hours: number;
  set_by: string | null;
  set_at: string;
}

export async function plannedHours(campusIds: number[] | null): Promise<PlannedHours[]> {
  const rows = await db().query(
    `select campus_id, program, admission_year, subject, hours::float as hours, set_by,
            set_at::text as set_at
     from prime_planned_hours where $1::int[] is null or campus_id = any($1::int[])`,
    [campusIds]
  );
  return rows as PlannedHours[];
}

export interface TaughtHours {
  campus_id: number;
  program: string;
  admission_year: number;
  subject: string;
  hours: number | null;
  trainers: string | null;
}

/** Hours taught and faculty typed in by HQ, for subjects the LMS timetable does not cover. */
export async function taughtHours(campusIds: number[] | null): Promise<TaughtHours[]> {
  const rows = await db().query(
    `select campus_id, program, admission_year, subject, hours::float as hours, trainers
     from prime_taught_hours where $1::int[] is null or campus_id = any($1::int[])`,
    [campusIds]
  );
  return rows as TaughtHours[];
}

/**
 * Some students' PRIME domain subjects: tests released to them, submitted and the average score,
 * and the classes they attended. Only students at campuses the viewer may see.
 */
export async function peopleSubjects(slugs: string[], campusIds: number[] | null) {
  if (!slugs.length) return {};
  const rows = await db().query(
    `with who as (
       select lms_user_id, username from students
       where username = any($1::text[]) and ($2::int[] is null or campus_id = any($2::int[]))),
     enrol as (
       select distinct w.lms_user_id, w.username, cs.section_id, c.id as course_id,
              ${SUBJECT('c.name')} as subject
       from who w
       join lms_section_students ss on ss.lms_user_id = w.lms_user_id
       join lms_course_sections cs on cs.section_id = ss.section_id
       join lms_courses c on c.id = cs.course_id
       where ${IS_DOMAIN('c.name')}),
     tests as (
       select e.username, e.subject, count(distinct r.test_id)::int as released,
              count(distinct r.test_id) filter (where tr.submitted)::int as submitted,
              round(avg(${scorePct('tr', 't')}) filter (where tr.submitted))::int as avg
       from enrol e
       left join lms_test_releases r on r.section_id = e.section_id and r.course_id = e.course_id
         and r.visible and r.release_at <= ${NOW}
       left join lms_tests t on t.id = r.test_id
       left join lms_test_results tr on tr.test_id = r.test_id and tr.lms_user_id = e.lms_user_id
       group by 1, 2),
     att as (
       select w.username, ${SUBJECT('a.subject')} as subject,
              sum(a.sessions)::int as classes, sum(a.present)::int as attended
       from who w join att_student_subject a on a.lms_user_id = w.lms_user_id
       where ${IS_DOMAIN('a.subject')}
       group by 1, 2)
     select coalesce(t.username, a.username) as username, coalesce(t.subject, a.subject) as subject,
            coalesce(t.released, 0) as released, coalesce(t.submitted, 0) as submitted, t.avg,
            a.classes, a.attended
     from tests t full join att a using (username, subject)
     order by 1, 2`,
    [slugs, campusIds]
  );
  const out: Record<
    string,
    {
      subject: string;
      released: number;
      submitted: number;
      avg: number | null;
      classes: number | null;
      attended: number | null;
    }[]
  > = {};
  for (const row of rows) {
    (out[String(row.username)] ??= []).push({
      subject: String(row.subject),
      released: Number(row.released),
      submitted: Number(row.submitted),
      avg: row.avg == null ? null : Number(row.avg),
      classes: row.classes == null ? null : Number(row.classes),
      attended: row.attended == null ? null : Number(row.attended),
    });
  }
  return out;
}

/** Students needed on each side (opted in, not) for a batch to be compared. */
const MIN_SIDE = 30;

/**
 * PRIME opt-in students against everyone else at the same campuses, overall and per batch. Only
 * batches in placement season (at least 3 students placed) with at least MIN_SIDE students on
 * each side are compared: older batches had no PRIME to opt into, and comparing them with
 * today's batches would compare years, not PRIME. Medians are worked out here, so this is made
 * per request for the viewer's campuses.
 */
export async function optInComparison(campusIds: number[] | null) {
  const rows = await db().query(
    `with pop as (
       select * from placement_population
       where campus_id is not null and ($1::int[] is null or campus_id = any($1::int[]))),
     season as (
       select program, admission_year from pop
       group by 1, 2
       having count(*) filter (where ft_offers > 0 or intern_offers > 0) >= 3
          and count(*) filter (where opted_in) >= ${MIN_SIDE}
          and count(*) filter (where not opted_in) >= ${MIN_SIDE})
     select opted_in, program, admission_year, grouping(program) = 1 as overall,
            count(*)::int as students,
            count(*) filter (where ft_offers > 0)::int as ft_placed,
            (percentile_cont(0.5) within group (order by ft_best_lpa)
               filter (where ft_offers > 0))::numeric(7, 2)::float as ft_median,
            max(ft_best_lpa)::float as ft_highest,
            count(*) filter (where intern_offers > 0)::int as in_placed,
            (percentile_cont(0.5) within group (order by intern_best_stipend)
               filter (where intern_offers > 0))::int as in_median
     from pop join season using (program, admission_year)
     group by grouping sets ((opted_in), (opted_in, program, admission_year))
     order by overall desc, program, admission_year, opted_in desc`,
    [campusIds]
  );
  // Every batch at these campuses, opted in and not, so the page can say which were left out.
  const batches = await db().query(
    `select program, admission_year::int as admission_year,
            count(*) filter (where opted_in)::int as opted_in,
            count(*) filter (where not opted_in)::int as not_opted_in,
            count(*) filter (where ft_offers > 0 or intern_offers > 0)::int as placed
     from placement_population
     where campus_id is not null and ($1::int[] is null or campus_id = any($1::int[]))
     group by 1, 2 order by 1, 2`,
    [campusIds]
  );
  return {
    minSide: MIN_SIDE,
    rows: rows.map((row) => ({
      ...row,
      admission_year: row.admission_year == null ? null : Number(row.admission_year),
    })),
    batches,
  };
}

/** Narrows rows made for everyone to the viewer's campuses, and to one campus if chosen. */
export function narrow<T extends { campus_id: number }>(
  rows: T[],
  viewer: Viewer,
  campusId: number | null
) {
  return rows.filter(
    (row) =>
      (viewer.campusIds === null || viewer.campusIds.includes(row.campus_id)) &&
      (campusId === null || row.campus_id === campusId)
  );
}
