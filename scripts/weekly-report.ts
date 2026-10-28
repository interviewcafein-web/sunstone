// The weekly report: the 360° view (coding, attendance, PRIME tests, AMCAT, exams), pain
// points, top performers and who needs attention, by email and in the bell.
//   HQ gets the all-campus report; each campus's staff get their campus's report, with every
//   HQ member and super admin copied in.
// It uses the same model as the 360° page (src/lib/insights.ts), so the numbers match.
//
//   npx tsx --env-file=.env.local scripts/weekly-report.ts                         summary only
//   npx tsx --env-file=.env.local scripts/weekly-report.ts --preview-to me@x.com [--campus "IITM Group of Institutions"]
//        the all-campus report and one campus's report to that address only; nothing in the bell
//   npx tsx --env-file=.env.local scripts/weekly-report.ts --save DIR              writes the HTML files
//   npx tsx --env-file=.env.local scripts/weekly-report.ts --send                  everyone + bell
//
// Runs on Monday mornings from .github/workflows/weekly-report.yml.

import { neon } from '@neondatabase/serverless';

import type { Viewer } from '../api/_auth';
import { metrics } from '../api/assessments';
import { sendEmails, type Email } from '../api/_email';
import { listStudents } from '../api/_roster';
import type { PlatformSummary } from '../src/lib/coding-profiles/summaries';
import {
  DIMENSIONS,
  bandOf,
  buildInsights,
  findPainPoints,
  groupBy,
  groupStats,
  type GroupStats,
  type PainPoint,
  type StudentInsight,
} from '../src/lib/insights';
import { BAND, SITE, escape, frame, pill, section, table } from './_email-blocks';
import { addNotice, staffDirectory } from './_notify';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set.');
const sql = neon(url);
const args = process.argv.slice(2);
const value = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const previewTo = value('--preview-to');
const previewCampus = value('--campus');
const saveTo = value('--save');
const send = args.includes('--send');

// --- Data: exactly what the 360° page builds, for every campus --------------------------

const everyone: Viewer = {
  user: 'vertex',
  name: 'Vertex',
  picture: null,
  role: 'super_admin',
  campusIds: null,
};
const students = await listStudents(everyone);
const { students: studentMetrics } = await metrics(everyone);
const summaries = new Map(
  (await sql`select platform, handle, summary from platform_stats where summary is not null`).map(
    (row) => [`${row.platform}:${row.handle}`, row.summary as PlatformSummary]
  )
);
const insights = buildInsights(students, studentMetrics as never, (platform, handle) =>
  summaries.get(`${platform}:${handle}`)
);

const campusRows = await sql`
  select s.campus_id::int as id, min(s.campus) as name, min(k.logo_url) as logo
  from students s left join campuses k on k.id = s.campus_id
  where s.on_platform and s.campus_id is not null group by s.campus_id`;
const campusByName = new Map(campusRows.map((row) => [String(row.name), row]));
const newTests = new Map(
  (
    await sql`
      select s.campus_id::int as id, count(distinct lower(trim(t.name)))::int as tests
      from lms_test_releases r join lms_section_students ss using (section_id)
      join students s on s.lms_user_id = ss.lms_user_id and s.on_platform
      join lms_tests t on t.id = r.test_id
      where r.visible and r.release_at > (now() at time zone 'Asia/Kolkata') - interval '7 days'
        and r.release_at <= (now() at time zone 'Asia/Kolkata')
      group by s.campus_id`
  ).map((row) => [Number(row.id), Number(row.tests)])
);

// The week just ended, Monday to Sunday.
const today = new Date();
const monday = new Date(today);
monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7);
const sunday = new Date(monday);
sunday.setDate(monday.getDate() + 6);
const day = (date: Date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const week = `${day(monday)} – ${day(sunday)} ${sunday.getFullYear()}`;

// --- Email pieces --------------------------------------------------------------------------

const bandColor = (band: keyof typeof BAND) => BAND[band];
const overallColor = (score: number | null) =>
  score === null ? BAND.none : score >= 70 ? BAND.good : score >= 50 ? BAND.ok : BAND.risk;

function headline(scope: GroupStats, testsThisWeek: number) {
  const atRisk = scope.critical;
  const weeks = scope.attendanceWeeks;
  const change = weeks.length >= 2 ? weeks[weeks.length - 1] - weeks[weeks.length - 2] : null;
  const active = scope.activityKnown
    ? Math.round((scope.activeLastWeek / scope.activityKnown) * 100)
    : null;
  const tile = (label: string, value: string, color: string, note: string) => `
    <td width="25%" valign="top" style="padding:4px">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 10px;text-align:center">
        <div style="font-size:22px;font-weight:bold;color:${color}">${value}</div>
        <div style="margin-top:2px;font-size:11px;font-weight:bold;color:#334155">${label}</div>
        <div style="margin-top:2px;font-size:10px;color:#64748b">${note}</div>
      </div>
    </td>`;
  return `<tr><td style="padding:22px 24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${tile('Overall health', scope.overall === null ? '—' : String(scope.overall), overallColor(scope.overall), `${scope.students.toLocaleString('en-IN')} students`)}
      ${tile('At risk on 3+ fronts', atRisk.toLocaleString('en-IN'), atRisk ? BAND.risk : BAND.good, 'start here')}
      ${tile('Attendance last week', weeks.length ? `${weeks[weeks.length - 1]}%` : '—', BAND[bandOf(DIMENSIONS[1], weeks.at(-1) ?? null)], change === null ? 'no trend yet' : `${change >= 0 ? '▲ +' : '▼ '}${Math.abs(change)} vs week before`)}
      ${tile('New tests this week', String(testsThisWeek), '#274f87', active === null ? 'released' : `${active}% coded last week`)}
    </tr></table>
  </td></tr>`;
}

function fronts(scope: GroupStats, benchmark?: GroupStats) {
  const rows = DIMENSIONS.map((dimension) => {
    const stats = scope.dims[dimension.id];
    const band = bandOf(dimension, stats.avg);
    const total = stats.good + stats.ok + stats.risk || 1;
    const bar = (count: number, color: string) =>
      count
        ? `<td width="${Math.max(1, Math.round((count / total) * 100))}%" style="height:8px;background:${color}"></td>`
        : '';
    const versus =
      benchmark && stats.avg !== null && benchmark.dims[dimension.id].avg !== null
        ? stats.avg - benchmark.dims[dimension.id].avg!
        : null;
    return [
      `<b>${dimension.label}</b><div style="font-size:11px;color:#64748b">${stats.coverage}% have data</div>`,
      `<span style="font-size:16px;font-weight:bold;color:${bandColor(band)}">${stats.avg === null ? '—' : `${stats.avg}${dimension.suffix}`}</span>${
        versus
          ? `<div style="font-size:11px;font-weight:bold;color:${versus > 0 ? BAND.good : BAND.risk}">${versus > 0 ? '+' : ''}${versus} vs all</div>`
          : ''
      }`,
      stats.n
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:4px;overflow:hidden"><tr>${bar(stats.good, BAND.good)}${bar(stats.ok, BAND.ok)}${bar(stats.risk, BAND.risk)}</tr></table>
           <div style="margin-top:4px;font-size:10px;color:#64748b">${Math.round((stats.good / total) * 100)}% well · ${Math.round((stats.ok / total) * 100)}% average · <span style="color:${BAND.risk}">${Math.round((stats.risk / total) * 100)}% at risk</span></div>`
        : '<span style="color:#94a3b8">No data</span>',
    ];
  });
  return section(
    'The five fronts',
    table([{ label: 'Front' }, { label: 'Average', align: 'center' }, { label: 'Students' }], rows),
    'Coding is the best solved count on one platform (100+ is full marks).'
  );
}

const SEVERITY = { high: BAND.risk, medium: BAND.ok, low: BAND.none } as const;

function pains(points: PainPoint[]) {
  if (!points.length) {
    return section(
      'Pain points',
      `<div style="font-size:14px;color:${BAND.good}">Nothing stands out this week. 🎉</div>`
    );
  }
  return section(
    'Pain points',
    points
      .slice(0, 6)
      .map(
        (point) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;border:1px solid #e2e8f0;border-left:4px solid ${SEVERITY[point.severity]};border-radius:10px">
        <tr><td style="padding:10px 12px">
          <div style="font-size:14px;font-weight:bold;color:#0f172a">${escape(point.title)} ${pill(point.severity === 'high' ? 'High' : point.severity === 'medium' ? 'Medium' : 'Low', SEVERITY[point.severity])}</div>
          <div style="margin-top:2px;font-size:12px;color:#64748b">${escape(point.detail)}</div>
        </td></tr>
      </table>`
      )
      .join(''),
    'Most pressing first.'
  );
}

function comparison(groups: GroupStats[], noun: string) {
  const sorted = [...groups].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
  const cell = (value: number | null, color: string, suffix = '') =>
    value === null
      ? '<span style="color:#cbd5e1">—</span>'
      : `<span style="display:inline-block;min-width:34px;padding:2px 6px;border-radius:6px;background:${color}1a;color:${color};font-weight:bold">${value}${suffix}</span>`;
  return section(
    `${noun} comparison`,
    table(
      [
        { label: noun },
        { label: 'Overall', align: 'center' },
        ...DIMENSIONS.map((dimension) => ({ label: dimension.short, align: 'center' as const })),
      ],
      sorted.map((group, index) => [
        `<span style="color:#94a3b8">${index + 1}.</span> <b>${escape(group.key)}</b><div style="font-size:11px;color:#64748b">${group.students} students</div>`,
        cell(group.overall, overallColor(group.overall)),
        ...DIMENSIONS.map((dimension) =>
          cell(
            group.dims[dimension.id].avg,
            bandColor(bandOf(dimension, group.dims[dimension.id].avg)),
            dimension.suffix
          )
        ),
      ])
    ),
    'Green doing well, amber average, red at risk.'
  );
}

function people(rows: StudentInsight[], showCampus: boolean) {
  const where = (row: StudentInsight) =>
    [showCampus ? row.student.campus : '', row.student.course, row.student.batch]
      .filter(Boolean)
      .join(' · ');
  const name = (row: StudentInsight) =>
    `<a href="${SITE}/s/${encodeURIComponent(row.student.slug)}" style="color:#1a3e70;font-weight:bold;text-decoration:none">${escape(row.student.name)}</a><div style="font-size:11px;color:#64748b">${escape(where(row))}</div>`;

  const coders = rows
    .filter((row) => (row.solved ?? 0) > 0)
    .sort((a, b) => (b.solved ?? 0) - (a.solved ?? 0))
    .slice(0, 5);
  const rounders = rows
    .filter((row) => DIMENSIONS.filter((d) => row.scores[d.id] !== null).length >= 3)
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 5);
  const flagged = rows
    .filter((row) => row.risks.length >= 2)
    .sort((a, b) => b.risks.length - a.risks.length || (a.overall ?? 100) - (b.overall ?? 100));
  const medal = ['🥇', '🥈', '🥉', '4.', '5.'];

  return (
    (coders.length
      ? section(
          '🏆 Top coders',
          table(
            [{ label: 'Student' }, { label: 'Solved', align: 'right' }],
            coders.map((row, index) => [
              `${medal[index]} ${name(row)}`,
              `<b>${row.solved!.toLocaleString('en-IN')}</b>`,
            ])
          ),
          'Best solved count on one platform.'
        )
      : '') +
    (rounders.length
      ? section(
          '⭐ All-rounders',
          table(
            [{ label: 'Student' }, { label: 'Overall', align: 'right' }],
            rounders.map((row, index) => [
              `${medal[index]} ${name(row)}`,
              `<b style="color:${overallColor(row.overall)}">${row.overall}</b>`,
            ])
          ),
          'Highest overall score with data on three fronts or more.'
        )
      : '') +
    (flagged.length
      ? section(
          '🚩 Students who need attention',
          table(
            [{ label: 'Student' }, { label: 'At risk on' }],
            flagged
              .slice(0, 8)
              .map((row) => [
                name(row),
                row.risks
                  .map((id) => pill(DIMENSIONS.find((d) => d.id === id)!.short, BAND.risk))
                  .join(' '),
              ])
          ),
          `${flagged.length.toLocaleString('en-IN')} students are at risk on two fronts or more${flagged.length > 8 ? '; the full list is in Vertex' : ''}.`
        )
      : '')
  );
}

function reportEmail(
  scope: GroupStats,
  rows: StudentInsight[],
  groups: GroupStats[],
  options: { campus?: string; logo?: string | null; benchmark?: GroupStats; testsThisWeek: number }
) {
  const noun = options.campus ? 'Batch' : 'Campus';
  const points = findPainPoints(scope, groups, options.campus ? 'batches' : 'campuses');
  const link = options.campus
    ? `/insights?campus=${encodeURIComponent(options.campus)}`
    : '/insights';
  const title = options.campus ?? 'All campuses';
  const subject = `Weekly report · ${title} · ${week}`;
  const html = frame({
    kicker: 'Weekly report',
    title,
    subtitle: `Week of ${week}`,
    preheader: `Overall ${scope.overall ?? '—'} · ${scope.critical} at risk on 3+ fronts · ${points[0]?.title ?? 'no pain points'}`,
    logo: options.logo,
    content:
      headline(scope, options.testsThisWeek) +
      pains(points) +
      fronts(scope, options.benchmark) +
      (groups.length > 1 ? comparison(groups, noun) : '') +
      people(rows, !options.campus),
    cta: { label: 'Open the 360° view', href: `${SITE}${link}` },
    footer: options.campus
      ? `Sent every Monday to ${escape(options.campus)} staff, with HQ copied.`
      : 'Sent every Monday to HQ.',
  });
  const text = [
    subject,
    '',
    `Overall health: ${scope.overall ?? '—'} · ${scope.students} students · ${scope.critical} at risk on 3+ fronts`,
    '',
    'Pain points:',
    ...points.slice(0, 6).map((point) => `- ${point.title}: ${point.detail}`),
    '',
    ...DIMENSIONS.map(
      (d) =>
        `${d.label}: ${scope.dims[d.id].avg ?? '—'}${d.suffix} (${scope.dims[d.id].coverage}% have data)`
    ),
    '',
    `Open: ${SITE}${link}`,
  ].join('\n');
  return { subject, text, html, link, points };
}

// --- Build every report --------------------------------------------------------------------

const all = groupStats('All campuses', insights);
const campusGroups = groupBy(insights, (row) => row.student.campus).filter(
  (group) => group.students >= 5
);
const totalNewTests = [...newTests.values()].reduce((sum, count) => sum + count, 0);
const overall = reportEmail(all, insights, campusGroups, { testsThisWeek: totalNewTests });

const campusReports = campusGroups.map((group) => {
  const rows = insights.filter((row) => row.student.campus === group.key);
  const campus = campusByName.get(group.key);
  const batches = groupBy(rows, (row) => row.student.batch).filter((batch) => batch.students >= 5);
  return {
    name: group.key,
    id: campus ? Number(campus.id) : null,
    stats: group,
    ...reportEmail(group, rows, batches, {
      campus: group.key,
      logo: (campus?.logo as string | null) ?? null,
      benchmark: all,
      testsThisWeek: campus ? (newTests.get(Number(campus.id)) ?? 0) : 0,
    }),
  };
});

console.log(`Week ${week}: ${insights.length} students, ${campusReports.length} campus reports.`);
console.log(
  `All campuses: overall ${all.overall}, ${all.critical} at risk on 3+; top pain: ${overall.points[0]?.title ?? '—'}`
);

if (saveTo) {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(saveTo, { recursive: true });
  writeFileSync(`${saveTo}/all-campuses.html`, overall.html);
  for (const report of campusReports) {
    writeFileSync(`${saveTo}/${report.name.replace(/[^a-z0-9]+/gi, '-')}.html`, report.html);
  }
  console.log(`Saved ${1 + campusReports.length} reports to ${saveTo}.`);
} else if (previewTo) {
  const sample = previewCampus
    ? campusReports.find((report) => report.name === previewCampus)
    : [...campusReports].sort((a, b) => b.stats.students - a.stats.students)[0];
  if (previewCampus && !sample) throw new Error(`No campus named "${previewCampus}".`);
  const emails: Email[] = [
    {
      to: previewTo,
      subject: `[Preview] ${overall.subject}`,
      text: overall.text,
      html: overall.html,
    },
  ];
  if (sample) {
    emails.push({
      to: previewTo,
      subject: `[Preview] ${sample.subject}`,
      text: sample.text,
      html: sample.html,
    });
  }
  await sendEmails(emails);
  console.log(`Preview sent to ${previewTo}: all campuses${sample ? ` and ${sample.name}` : ''}.`);
} else if (send) {
  const directory = await staffDirectory(sql);
  const emails: Email[] = [];
  const hqEmail = await addNotice(sql, directory, {
    title: `Weekly report: all campuses (${week})`,
    body:
      overall.points
        .slice(0, 3)
        .map((point) => `• ${point.title}`)
        .join('\n') || 'Nothing stands out this week.',
    link: overall.link,
    level: 'info',
    campusId: null,
    email: overall,
  });
  if (hqEmail) emails.push(hqEmail);
  for (const report of campusReports) {
    if (report.id === null) continue;
    const email = await addNotice(sql, directory, {
      title: `Weekly report: ${report.name} (${week})`,
      body:
        report.points
          .slice(0, 3)
          .map((point) => `• ${point.title}`)
          .join('\n') || 'Nothing stands out this week.',
      link: report.link,
      level: 'info',
      campusId: report.id,
      email: report,
    });
    if (email) emails.push(email);
  }
  const sent = await sendEmails(emails);
  console.log(
    `Sent ${sent} weekly report emails and ${1 + campusReports.length} bell notifications.`
  );
} else {
  for (const report of campusReports) {
    console.log(
      `- ${report.name}: overall ${report.stats.overall}, ${report.stats.critical} at risk; ${report.points[0]?.title ?? '—'}`
    );
  }
  console.log('\nNothing sent. Use --preview-to EMAIL to see it, or --send to send it.');
}
