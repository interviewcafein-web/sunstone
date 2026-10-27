// The student list from the database (see db/migrations and scripts/import-students.ts),
// shaped as the `Student` objects the app already uses. Contact details stay server-side.

import type { Handles, PlatformId } from '../src/lib/coding-profiles/types';
import type { Student } from '../src/lib/students/types';
import { type Viewer, seesCampus } from './_auth';
import { db } from './_db';

const PLATFORMS: PlatformId[] = [
  'leetcode',
  'geeksforgeeks',
  'hackerrank',
  'codeforces',
  'codechef',
  'github',
];

const COLUMNS = `id, username, campus_id, name, campus, program, admission_year, invalid_handles,
  leetcode, geeksforgeeks, hackerrank, codeforces, codechef, github,
  is_debarred, debarred_reason, debarred_until::text as debarred_until, is_inactive, inactive_reason`;

type Row = Record<string, unknown>;

const text = (value: unknown) => (value == null ? null : String(value));

function toStudent(row: Row, staff: boolean): Student {
  const handles: Handles = {};
  for (const platform of PLATFORMS) {
    if (row[platform]) handles[platform] = String(row[platform]);
  }
  const student: Student = {
    id: String(row.id),
    slug: String(row.username),
    name: String(row.name),
    campus: String(row.campus),
    course: String(row.program),
    batch: row.admission_year ? String(row.admission_year) : 'Not specified',
    handles,
    invalid: (row.invalid_handles as PlatformId[]) ?? [],
  };
  if (staff && (row.is_debarred || row.is_inactive)) {
    student.status = {};
    if (row.is_debarred) {
      student.status.debarred = {
        reason: text(row.debarred_reason),
        until: text(row.debarred_until),
      };
    }
    if (row.is_inactive) student.status.inactive = { reason: text(row.inactive_reason) };
  }
  return student;
}

/** Everyone on the platform that this staff member may see (campus staff: their campuses). */
export async function listStudents(viewer: Viewer): Promise<Student[]> {
  const rows = await db().query(
    `select ${COLUMNS} from students
     where on_platform and ($1::int[] is null or campus_id = any($1::int[]))
     order by name`,
    [viewer.campusIds]
  );
  return rows.map((row) => toStudent(row, true));
}

/**
 * One student by username or an old profile address. Staff who may see the student's campus
 * get the staff view (LMS standing, students without coding profiles). Everyone else gets the
 * public view: only students who linked a coding profile, and nothing about LMS standing.
 */
export async function findStudent(slug: string, viewer: Viewer | null): Promise<Student | null> {
  const [row] = await db().query(
    `select ${COLUMNS}, form_submitted_at is not null as linked from students
     where on_platform and (lower(username) = lower($1) or $1 = any(legacy_slugs))
     limit 1`,
    [slug]
  );
  if (!row) return null;
  const staff =
    viewer !== null && seesCampus(viewer, row.campus_id == null ? null : Number(row.campus_id));
  if (!staff && !row.linked) return null;
  return toStudent(row, staff);
}

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);
