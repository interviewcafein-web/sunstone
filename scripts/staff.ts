// Who may sign in with Google or an emailed code, and what they see. The Team page in the app
// does the same for super admins and HQ; this is for setting things up from a terminal.
//   npm run staff                                                   list everyone
//   npm run staff -- add name@sunstone.in "Full Name"                HQ (every campus)
//   npm run staff -- add name@sunstone.in "Full Name" --campus 1123,1126   campus team
//   npm run staff -- remove name@sunstone.in      (keeps the row, ends access within a minute)

import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

const args = process.argv.slice(2);
const campusFlag = args.indexOf('--campus');
const campusIds =
  campusFlag >= 0
    ? (args.splice(campusFlag, 2)[1] ?? '').split(',').map(Number).filter(Boolean)
    : [];
const [command = 'list', rawEmail, ...nameParts] = args;
const email = rawEmail?.trim().toLowerCase();

if (command === 'add' || command === 'remove') {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(
      `Usage: npm run staff -- ${command} <email>${command === 'add' ? ' "Name"' : ''}`
    );
  }
}

if (command === 'add') {
  const name = nameParts.join(' ').trim() || null;
  const role = campusIds.length ? 'campus' : 'hq';
  if (campusFlag >= 0 && !campusIds.length)
    throw new Error('--campus needs LMS campus ids, e.g. 1123,1126');
  await sql`
    insert into staff (email, name, role, campus_ids, added_by)
    values (${email}, ${name}, ${role}, ${campusIds}::int[], 'terminal')
    on conflict (email) do update set active = true, role = excluded.role,
      campus_ids = excluded.campus_ids, name = coalesce(excluded.name, staff.name), updated_at = now()`;
  console.log(
    `Added ${email}${name ? ` (${name})` : ''} as ${role === 'hq' ? 'HQ' : `campus team (${campusIds.join(', ')})`}.`
  );
} else if (command === 'remove') {
  const rows = await sql`update staff set active = false where email = ${email} returning email`;
  console.log(rows.length ? `Removed access for ${email}.` : `${email} is not in the staff list.`);
} else if (command !== 'list') {
  throw new Error('Commands: list, add <email> "Name", remove <email>');
}

const staff = await sql`
  select email, name, active, role, campus_ids, last_login_at::text as last_login
  from staff order by active desc, email`;
console.log(`\nStaff (${staff.filter((row) => row.active).length} active):`);
for (const row of staff) {
  console.log(
    `  ${row.active ? '✓' : '✗'} ${row.email}${row.name ? ` · ${row.name}` : ''} · ${row.role}` +
      `${row.role === 'campus' ? ` [${(row.campus_ids as number[]).join(', ')}]` : ''}` +
      `${row.last_login ? ` · last sign-in ${String(row.last_login).slice(0, 16)}` : ''}`
  );
}
