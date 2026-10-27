// The student list from the database (see db/migrations and scripts/import-students.ts),
// shaped as the `Student` objects the app already uses. Contact details stay server-side.

import type { Handles, PlatformId } from '../src/lib/coding-profiles/types';
import type { Student } from '../src/lib/students/types';
import { db } from './_db';

const PLATFORMS: PlatformId[] = [
  'leetcode',
  'geeksforgeeks',
  'hackerrank',
  'codeforces',
  'codechef',
  'github',
];

const COLUMNS = `id, username, name, campus, program, admission_year, invalid_handles,
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

/** Everyone on the platform, for signed-in staff. */
export async function listStudents(): Promise<Student[]> {
  const rows = await db().query(`select ${COLUMNS} from students where on_platform order by name`);
  return rows.map((row) => toStudent(row, true));
}

/**
 * One student by username or an old profile address. The public sees only students who
 * linked a coding profile through the form, and nothing about their LMS standing.
 */
export async function findStudent(slug: string, staff: boolean): Promise<Student | null> {
  const [row] = await db().query(
    `select ${COLUMNS} from students
     where on_platform and (lower(username) = lower($1) or $1 = any(legacy_slugs))
       and ($2 or form_submitted_at is not null)
     limit 1`,
    [slug, staff]
  );
  return row ? toStudent(row, staff) : null;
}

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);
