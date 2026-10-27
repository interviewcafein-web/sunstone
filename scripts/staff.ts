// Who may sign in with Google or an emailed code.
//   npm run staff                                   list everyone
//   npm run staff -- add name@sunstone.in "Full Name"
//   npm run staff -- remove name@sunstone.in        (keeps the row, ends access within a minute)

import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (add it to .env.local).');
const sql = neon(url);

const [command = 'list', rawEmail, ...nameParts] = process.argv.slice(2);
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
  await sql`
    insert into staff (email, name) values (${email}, ${name})
    on conflict (email) do update set active = true, name = coalesce(excluded.name, staff.name)`;
  console.log(`Added ${email}${name ? ` (${name})` : ''}.`);
} else if (command === 'remove') {
  const rows = await sql`update staff set active = false where email = ${email} returning email`;
  console.log(rows.length ? `Removed access for ${email}.` : `${email} is not in the staff list.`);
} else if (command !== 'list') {
  throw new Error('Commands: list, add <email> "Name", remove <email>');
}

const staff = await sql`
  select email, name, active, last_login_at::text as last_login from staff order by active desc, email`;
console.log(`\nStaff (${staff.filter((row) => row.active).length} active):`);
for (const row of staff) {
  console.log(
    `  ${row.active ? '✓' : '✗'} ${row.email}${row.name ? ` · ${row.name}` : ''}` +
      `${row.last_login ? ` · last sign-in ${String(row.last_login).slice(0, 16)}` : ''}`
  );
}
