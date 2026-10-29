// Tells each campus about PRIME tests released to its students since the last run: a bell
// notification and an email to the campus's staff, with HQ copied in. Runs after the
// nightly assessment sync (.github/workflows/sync-lms.yml).
//
//   npx tsx --env-file=.env.local scripts/notify-new-tests.ts            send
//   npx tsx --env-file=.env.local scripts/notify-new-tests.ts --dry-run  list only
//   ... --dry-run --since "2026-10-20 00:00"   list what a run from that time would announce
//
// The first run only records where to start, so old tests are never announced. LMS times
// are India time without a zone, so the cursor is kept in India time too.

import { neon } from '@neondatabase/serverless';

import { sendEmails, type Email } from '../api/_email';
import { BAND, SITE, escape, frame, section, table } from './_email-blocks';
import { addNotice, staffDirectory } from './_notify';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set.');
const sql = neon(url);
const dryRun = process.argv.includes('--dry-run');
const since =
  dryRun && process.argv.includes('--since')
    ? process.argv[process.argv.indexOf('--since') + 1]
    : undefined;
const CURSOR = 'notify-new-tests';

const [{ now }] = await sql`select (now() at time zone 'Asia/Kolkata')::text as now`;
const [saved] = await sql`select detail->>'until' as until from sync_state where name = ${CURSOR}`;
const state = since ? { until: since } : saved;
const saveCursor = () =>
  sql`insert into sync_state (name, ran_at, detail) values (${CURSOR}, now(), ${JSON.stringify({ until: now })}::jsonb)
      on conflict (name) do update set ran_at = now(), detail = excluded.detail`;

if (!state?.until) {
  if (!dryRun) await saveCursor();
  console.log(`First run: tests released after ${now} will be announced from now on.`);
  process.exit(0);
}

// Tests that went live for our students in the window, per campus (section copies merged).
const rows = await sql`
  select s.campus_id::int as campus_id, min(s.campus) as campus, min(t.name) as name,
         min(t.category) as category, max(t.max_marks) as max_marks,
         min(r.release_at)::text as released, max(r.due_at)::text as due,
         count(distinct ss.lms_user_id)::int as students,
         (select logo_url from campuses k where k.id = s.campus_id) as logo
  from lms_test_releases r
  join lms_section_students ss using (section_id)
  join students s on s.lms_user_id = ss.lms_user_id and s.on_platform
  join lms_tests t on t.id = r.test_id
  where r.visible and r.release_at > ${state.until}::timestamp and r.release_at <= ${now}::timestamp
  group by s.campus_id, lower(trim(t.name)), t.max_marks
  order by min(s.campus), min(r.release_at)`;

const byCampus = new Map<number, typeof rows>();
for (const row of rows) byCampus.set(row.campus_id, [...(byCampus.get(row.campus_id) ?? []), row]);
console.log(
  `${rows.length} new test releases across ${byCampus.size} campuses since ${state.until}.`
);

const when = (value: string | null) =>
  value
    ? new Date(value.replace(' ', 'T').slice(0, 19)).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';
const CATEGORY: Record<string, string> = {
  test: 'Test',
  assignment: 'Assignment',
  mcq: 'MCQ',
  amcat_mock: 'AMCAT mock',
};

const directory = await staffDirectory(sql);
const emails: Email[] = [];
for (const [campusId, tests] of byCampus) {
  const campus = String(tests[0].campus);
  const names = tests.map((test) => String(test.name));
  const title =
    tests.length === 1
      ? `New PRIME Mock Test at ${campus}: ${names[0]}`
      : `${tests.length} new PRIME Mock Tests at ${campus}`;
  const body = tests
    .map(
      (test) =>
        `• ${test.name} (${CATEGORY[test.category] ?? test.category}) for ${test.students} students` +
        (test.due ? `, due ${when(test.due)}` : '')
    )
    .join('\n');
  const link = `/campuses?campus=${campusId}`;
  if (dryRun) {
    console.log(`\n${title}\n${body}`);
    continue;
  }

  const html = frame({
    kicker: 'New tests',
    title:
      tests.length === 1
        ? 'A new PRIME Mock Test is live'
        : `${tests.length} new PRIME Mock Tests are live`,
    subtitle: campus,
    logo: tests[0].logo as string | null,
    preheader: `${names.slice(0, 3).join(', ')} released to ${campus} students.`,
    content: section(
      'Released to your students',
      table(
        [
          { label: 'Test' },
          { label: 'Type' },
          { label: 'Students', align: 'right' },
          { label: 'Released' },
          { label: 'Due' },
        ],
        tests.map((test) => [
          `<b>${escape(String(test.name))}</b>${test.max_marks ? `<div style="font-size:11px;color:#64748b">${Number(test.max_marks)} marks</div>` : ''}`,
          escape(CATEGORY[test.category] ?? String(test.category)),
          String(test.students),
          when(test.released),
          test.due
            ? `<span style="color:${BAND.ok};font-weight:bold">${when(test.due)}</span>`
            : '—',
        ])
      ),
      'Remind students to attempt it before it closes. Scores appear in Vertex after the nightly sync.'
    ),
    cta: { label: 'See the campus journey', href: `${SITE}${link}` },
    footer: `Sent automatically by Vertex to ${escape(campus)} staff, with HQ copied.`,
  });
  const email = await addNotice(sql, directory, {
    title,
    body,
    link,
    level: 'info',
    campusId,
    email: { subject: title, text: `${title}\n\n${body}\n\n${SITE}${link}`, html },
  });
  if (email) emails.push(email);
}

if (!dryRun) {
  const sent = emails.length ? await sendEmails(emails) : 0;
  await saveCursor();
  console.log(`Notified ${byCampus.size} campuses; ${sent} emails sent.`);
}
