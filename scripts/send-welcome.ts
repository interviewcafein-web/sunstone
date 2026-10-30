// Sends the Vertex welcome email (api/_email.ts) to staff, using each person's name, role
// and campuses from the staff table.
//
//   npx tsx --env-file=.env.local scripts/send-welcome.ts --to someone@sunstone.in
//       one person (must be active staff), e.g. to preview it
//   npx tsx --env-file=.env.local scripts/send-welcome.ts --all            lists who would get it
//   npx tsx --env-file=.env.local scripts/send-welcome.ts --all --yes      sends to every active staff member
//   add --not-signed-in to --all for only those who have never signed in (a nudge to start)
//
// Needs DATABASE_URL, RESEND_API_KEY and EMAIL_FROM.

import { neon } from '@neondatabase/serverless';

import { sendEmail, welcomeEmail } from '../api/_email';
import { ROLE_LABELS, type Role } from '../src/lib/roles';

const args = process.argv.slice(2);
const to = args.includes('--to') ? args[args.indexOf('--to') + 1]?.toLowerCase() : undefined;
const all = args.includes('--all');
const notSignedIn = args.includes('--not-signed-in');
if (!to && !all) throw new Error('Pass --to EMAIL, or --all (add --yes to actually send).');
if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
  throw new Error('RESEND_API_KEY and EMAIL_FROM must be set.');
}

const sql = neon(process.env.DATABASE_URL!);
const staff = await sql`
  select email, name, role, campus_ids from staff
  where active and (${to ?? null}::text is null or email = ${to ?? null})
    and (${notSignedIn}::boolean is false or last_login_at is null)
  order by role, email`;
if (!staff.length) throw new Error(to ? `${to} is not active staff.` : 'No active staff.');

const campusNames = new Map(
  (await sql`select distinct campus_id, campus from students where campus_id is not null`).map(
    (row) => [Number(row.campus_id), String(row.campus)]
  )
);

if (all && !args.includes('--yes')) {
  for (const person of staff) console.log(`${person.email}  (${person.role})`);
  console.log(`\n${staff.length} people. Run again with --yes to send.`);
  process.exit(0);
}

for (const person of staff) {
  const role = person.role as Role;
  const email = welcomeEmail({
    name: person.name as string | null,
    email: String(person.email),
    roleLabel: ROLE_LABELS[role] ?? String(role),
    // HQ and super admins see every campus.
    campuses:
      role === 'campus'
        ? (person.campus_ids as number[]).map((id) => campusNames.get(id) ?? `Campus ${id}`)
        : [],
  });
  await sendEmail({ to: String(person.email), ...email });
  console.log(`sent to ${person.email}`);
  // Resend allows a couple of requests a second.
  await new Promise((resolve) => setTimeout(resolve, 600));
}
