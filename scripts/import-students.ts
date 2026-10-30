// Fills the students table: every PRIME, active, tech (SST), FLAGSHIP student in the Sunstone
// LMS (read through Redash). Their coding usernames then come from the Google Form sheet,
// matched by email (api/_sheet-sync.ts, also run daily on its own).
// Safe to re-run: rows are updated in place, usernames never change once given, and
// students who stop matching the rules are hidden (on_platform = false), not deleted.
//
//   REDASH_KEY=... npm run db:import            (DATABASE_URL and SHEET_ID from .env.local)
//   REDASH_KEY=... npm run db:import -- --dry   (match and report, write nothing)

import { neon } from '@neondatabase/serverless';

import { syncSheet } from '../api/_sheet-sync';
import { personName } from './_names';
import { redash } from './_redash';

const DRY_RUN = process.argv.includes('--dry');
const PRIME_POLICY_ID = 20; // policies.type = 'PRIME_OPT_IN'
const INACTIVE_FLAG_ID = 1; // flag_master.name = 'is_student_inactive'

const PROGRAM_NAMES: Record<string, string> = { BTECH: 'B.Tech', BE: 'BE', BCA: 'BCA', MCA: 'MCA' };
// PRIME + active student + tech school (SST). FLAGSHIP is checked below: a student's
// offering comes from their own section, else from their campus/program/batch.
const LMS_QUERY = `
select u.id, trim(u.name) name, lower(trim(u.email)) email, lower(trim(u.sunstone_email)) sunstone_email,
  u.mobile, u.whatsapp_no, u.alternate_no, u.sunstone_student_id, u.college_roll_no,
  u.campus_id, trim(c.campus_fullname) campus, c.is_core, pr.short_name program, pr.course_type,
  u.admission_year, u.passing_year,
  coalesce(
    (select group_concat(distinct p.offering_type) from student_section_mapping ss
       join sections se on se.id = ss.section_id
       join program_campus_batch_mapping p on p.id = se.pcbm_id
     where ss.student_id = u.id and ss.status = '1'),
    (select group_concat(distinct p.offering_type) from program_campus_batch_mapping p
     where p.program_id = u.program and p.campus_id = u.campus_id and p.batch = u.admission_year
       and p.status = '1')) offering,
  (select concat_ws('|', d.debard_reason, if(d.is_permanent_debarded = 1, '', d.end_date))
     from user_debarded d
    where d.user_id = u.id and d.status = '1' and (d.is_permanent_debarded = 1 or d.end_date >= curdate())
    order by d.is_permanent_debarded desc, d.end_date desc limit 1) debarred,
  case when u.is_user_blocked = '1' then 'Account blocked' else
    (select b.reason from blocks b where b.user_id = u.id and b.status = '1' and b.is_blocked = 1
      order by b.modified desc limit 1) end blocked,
  (select coalesce(f.reason, 'Inactive') from user_flag_mapping f
    where f.user_id = u.id and f.flag_id = ${INACTIVE_FLAG_ID} and f.status = '1'
    order by f.modified desc limit 1) inactive
from users u
join (select distinct user_id from user_policy_mapping where policy_id = ${PRIME_POLICY_ID}) m on m.user_id = u.id
join programs pr on pr.id = u.program
left join campus c on c.id = u.campus_id
where u.role = 'student' and u.status = '1' and pr.course_type = 'SST' and u.admission_year <> '2050'`;

interface LmsStudent {
  id: number;
  name: string;
  email: string | null;
  sunstone_email: string | null;
  mobile: string | null;
  whatsapp_no: string | null;
  alternate_no: string | null;
  sunstone_student_id: string | null;
  college_roll_no: string | null;
  campus_id: number | null;
  campus: string | null;
  is_core: number | null;
  program: string;
  course_type: string;
  admission_year: string | null;
  passing_year: number | null;
  offering: string | null;
  debarred: string | null;
  blocked: string | null;
  inactive: string | null;
}

const digits = (value: string | null | undefined) => {
  const all = (value ?? '').replace(/\D/g, '');
  return all.length >= 10 ? all.slice(-10) : null;
};

/** "A Akash Kumar Rao" → "akash.rao": first and last name, initials dropped. */
function usernameBase(name: string): string {
  const words = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const real = words.filter((word) => word.length > 1);
  const parts = real.length ? real : words;
  const base = parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : (parts[0] ?? '');
  return (base.length >= 3 ? base : `${base || 'student'}.prime`).slice(0, 28);
}

// --- 1. Read the LMS ------------------------------------------------------------------

console.log('Reading the LMS through Redash…');
const all = await redash<LmsStudent>(LMS_QUERY);
const lms = all.filter((student) => (student.offering ?? '').includes('FLAGSHIP'));
console.log(`  ${all.length} PRIME tech students, ${lms.length} FLAGSHIP.`);

// --- 2. Usernames: keep existing ones, give new students first.last (+ a number) ---------

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

const existing = new Map<number, { username: string; legacy_slugs: string[] }>();
for (const row of await sql`select lms_user_id, username, legacy_slugs from students`) {
  existing.set(Number(row.lms_user_id), {
    username: String(row.username),
    legacy_slugs: row.legacy_slugs as string[],
  });
}
const taken = new Set<string>();
for (const row of existing.values()) {
  taken.add(row.username.toLowerCase());
  row.legacy_slugs.forEach((slug) => taken.add(slug.toLowerCase()));
}

function newUsername(name: string): string {
  const base = usernameBase(name);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

// --- 3. Build rows --------------------------------------------------------------------

const now = new Date().toISOString();
const rows = [...lms]
  .sort((a, b) => a.id - b.id) // earlier accounts get the plain first.last
  .map((student) => {
    const kept = existing.get(student.id);
    const name = personName(student.name);
    const [debarReason, debarUntil] = (student.debarred ?? '').split('|');
    return {
      lms_user_id: student.id,
      username: kept?.username ?? newUsername(name),
      on_platform: true,
      name,
      email: student.email,
      sunstone_email: student.sunstone_email,
      mobile: digits(student.mobile),
      sunstone_student_id: student.sunstone_student_id,
      college_roll_no: student.college_roll_no,
      campus_id: student.campus_id,
      campus: student.campus ?? 'Not specified',
      is_core_campus: student.is_core === 1,
      program: PROGRAM_NAMES[student.program] ?? student.program,
      course_type: student.course_type,
      offering_type: 'FLAGSHIP',
      admission_year: Number(student.admission_year) || null,
      passing_year: student.passing_year,
      is_prime: true,
      is_debarred: Boolean(student.debarred),
      debarred_reason: student.debarred ? debarReason || null : null,
      debarred_until: student.debarred && debarUntil ? debarUntil.slice(0, 10) : null,
      is_blocked: Boolean(student.blocked),
      blocked_reason: student.blocked,
      is_inactive: Boolean(student.inactive),
      inactive_reason: student.inactive,
      lms_synced_at: now,
    };
  });

console.log(`
LMS students to import:       ${rows.length}
  debarred (red tag):         ${rows.filter((row) => row.is_debarred).length}
  flagged inactive:           ${rows.filter((row) => row.is_inactive).length}
  blocked:                    ${rows.filter((row) => row.is_blocked).length}
  new / already in database:  ${rows.filter((row) => !existing.has(row.lms_user_id)).length} / ${rows.filter((row) => existing.has(row.lms_user_id)).length}`);
console.log(
  'Sample usernames:',
  rows
    .slice(0, 5)
    .map((row) => row.username)
    .join(', ')
);

if (DRY_RUN) {
  const sheet = await syncSheet({ dryRun: true });
  console.log(`Sheet entries matched by email: ${sheet.matched} of ${sheet.sheetEntries}`);
  console.log('\nDry run: nothing written.');
  process.exit(0);
}

// --- 4. Write -------------------------------------------------------------------------

const columns = Object.keys(rows[0]) as (keyof (typeof rows)[number])[];
const updates = columns
  .filter((column) => column !== 'lms_user_id' && column !== 'username')
  .map((column) => `${column} = excluded.${column}`)
  .concat('updated_at = now()')
  .join(', ');

// One transaction over Neon's HTTP driver: every batch is written, or none is.
const BATCH = 300;
const queries = [];
for (let start = 0; start < rows.length; start += BATCH) {
  const batch = rows.slice(start, start + BATCH);
  const values: unknown[] = [];
  const tuples = batch.map((row) => {
    const placeholders = columns.map((column) => {
      values.push(row[column]);
      return `$${values.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  queries.push(
    sql.query(
      `insert into students (${columns.join(', ')}) values ${tuples.join(', ')}
       on conflict (lms_user_id) do update set ${updates}`,
      values
    )
  );
}
queries.push(
  sql.query(
    `update students set on_platform = false, updated_at = now()
     where on_platform and not (lms_user_id = any($1::int[])) returning 1`,
    [rows.map((row) => row.lms_user_id)]
  )
);
const results = await sql.transaction(queries);
console.log(
  `\nWrote ${rows.length} students; ${results.at(-1)!.length} no longer eligible were hidden.`
);

// --- 5. Coding usernames from the form sheet, by email --------------------------------------

const sheet = await syncSheet();
console.log(
  `Sheet: ${sheet.matched} of ${sheet.sheetEntries} entries matched a student by email; ` +
    `${sheet.updated} updated, ${sheet.unmatched.length} with no matching student.`
);
