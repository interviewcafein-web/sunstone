// Copies the coding usernames from the Google Form sheet onto students in the database,
// matching on email only (the student's personal or Sunstone email in the LMS). A student
// who filled the form more than once gets their latest answers; an older answer never
// overwrites a newer one. Their old profile address (from before usernames) is kept so
// shared links still work.
//
// Used by /api/sync-sheet (daily cron + staff), `npm run db:sync-sheet` and the LMS import.

import { db } from './_db';
import { readSheet, type SheetStudent } from './_sheet';

const PLATFORMS = [
  'leetcode',
  'geeksforgeeks',
  'hackerrank',
  'codeforces',
  'codechef',
  'github',
] as const;

export interface SheetSyncResult {
  sheetEntries: number;
  matched: number;
  updated: number;
  /** Sheet entries whose email matches no student on the platform. */
  unmatched: { name: string; email: string; campus: string }[];
}

const emailsIn = (value: string) =>
  value.toLowerCase().match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];

/** "10/11/2026 4:57:49" (the form's timestamp, India time) → ISO. */
export function formTime(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, month, day, year, hour, minute, second] = match.map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, second) - 330 * 60_000
  ).toISOString();
}

export async function syncSheet({ dryRun = false } = {}): Promise<SheetSyncResult> {
  const sheet = await readSheet();
  if ('error' in sheet) throw new Error(sheet.error);

  const students = await db().query(
    `select id, lower(email) as email, lower(sunstone_email) as sunstone_email from students`
  );
  const byEmail = new Map<string, number>();
  for (const student of students) {
    // Where two accounts share an email, the newer one (higher id) is the one in use.
    for (const email of [student.email, student.sunstone_email]) {
      if (email && (byEmail.get(email) ?? 0) < Number(student.id)) {
        byEmail.set(email, Number(student.id));
      }
    }
  }

  const latest = new Map<number, SheetStudent>();
  const unmatched: SheetSyncResult['unmatched'] = [];
  const time = (entry: SheetStudent) => formTime(entry.submitted) ?? '';
  for (const entry of sheet.students) {
    const id = emailsIn(entry.email)
      .map((email) => byEmail.get(email))
      .find((found) => found !== undefined);
    if (id === undefined) {
      unmatched.push({ name: entry.name, email: entry.email, campus: entry.campus });
      continue;
    }
    const previous = latest.get(id);
    if (!previous || time(entry) > time(previous)) latest.set(id, entry);
  }

  const updates = [...latest].map(([id, entry]) => ({
    id,
    ...Object.fromEntries(PLATFORMS.map((platform) => [platform, entry.handles[platform] ?? null])),
    invalid: entry.invalid,
    submitted: formTime(entry.submitted),
    slug: entry.slug,
  }));

  let updated = 0;
  if (!dryRun && updates.length) {
    const rows = await db().query(
      `update students s set
         ${PLATFORMS.map((platform) => `${platform} = x.${platform}`).join(', ')},
         invalid_handles = x.invalid,
         form_submitted_at = x.submitted,
         legacy_slugs = case when x.slug = any(s.legacy_slugs) then s.legacy_slugs
                             else array_append(s.legacy_slugs, x.slug) end,
         updated_at = now()
       from jsonb_to_recordset($1::jsonb) as x(
         id bigint, ${PLATFORMS.map((platform) => `${platform} text`).join(', ')},
         invalid text[], submitted timestamptz, slug text)
       where s.id = x.id
         and (s.form_submitted_at is null or x.submitted is null or x.submitted >= s.form_submitted_at)
       returning s.id`,
      [JSON.stringify(updates)]
    );
    updated = rows.length;
  }

  return {
    sheetEntries: sheet.students.length,
    matched: latest.size,
    updated,
    unmatched,
  };
}
