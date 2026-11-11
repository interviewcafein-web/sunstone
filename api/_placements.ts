// Placements (job offers copied from the LMS by scripts/sync-placements.ts) set against how
// the students prepared: the numbers behind the Placements page, the reports and the weekly
// email. Students are compared within the batches in placement season, found from the offers
// themselves: a batch with offers of that kind (full-time or internship) is in season.
//
// The per-student rows (each in-season student's measures and offers) are saved once as a
// snapshot for everyone; each request narrows them to the viewer's campuses and works out the
// page from them, which is quick.

import { type Viewer } from './_auth';
import { currentApp } from './_app';
import { db, together } from './_db';
import { metricsByCampus } from './assessments';
import { snapshot, type WaitUntil } from './_snapshot';
import { JOINING } from '../src/lib/placements';

export type Kind = 'full-time' | 'internship';

/** A batch needs this many students with offers of a kind to count as in season for it. */
const SEASON_MIN = 3;

export interface Offer {
  company: string | null;
  designation: string | null;
  category: string | null;
  fullTime: boolean;
  totalLpa: number | null;
  fixedLpa: number | null;
  stipend: number | null;
  months: number | null;
  selectedOn: string | null;
  joining: number | null;
  joiningOn: string | null;
  withdrawn: boolean;
  withdrawnReason: string | null;
  crc: string | null;
}

interface StudentRow {
  slug: string;
  name: string;
  campusId: number | null;
  campus: string;
  program: string;
  year: number | null;
  cohorts: string[];
  /** Converge: the PRIME domain the student specialises in. */
  domain: string | null;
  measures: Record<string, number | null>;
  offers: Offer[];
}

export interface Measure {
  key: string;
  label: string;
  unit: '%' | '';
  /** Counted in the readiness average (percentages only). */
  readiness: boolean;
}

/** What each site compares placed and not-yet-placed students on. */
export function measuresFor(app = currentApp()): Measure[] {
  return app === 'converge'
    ? [
        { key: 'domain', label: 'PRIME Domain', unit: '%', readiness: true },
        { key: 'elq', label: 'Communication & Aptitude', unit: '%', readiness: true },
        { key: 'amcat', label: 'AMCAT', unit: '', readiness: false },
        { key: 'attendance', label: 'Attendance', unit: '%', readiness: true },
        { key: 'exams', label: 'Internal Exams', unit: '%', readiness: true },
      ]
    : [
        { key: 'tests', label: 'PRIME Mock Tests', unit: '%', readiness: true },
        { key: 'solved', label: 'Coding Practice', unit: '', readiness: false },
        { key: 'amcat', label: 'AMCAT', unit: '', readiness: false },
        { key: 'attendance', label: 'Attendance', unit: '%', readiness: true },
        { key: 'exams', label: 'Internal Exams', unit: '%', readiness: true },
      ];
}

const DOMAINS: [RegExp, string][] = [
  [/finance/i, 'Finance'],
  [/(^|[^a-z])hr([^a-z]|$)/i, 'HR'],
  [/(^|[^a-z])it([^a-z]|$)/i, 'IT'],
  [/operation/i, 'Operations'],
  [/revenue/i, 'Revenue Generation'],
];

/** The PRIME domain a role category calls for (Converge), or null for general roles. */
export function domainOfRole(category: string | null): string | null {
  if (!category) return null;
  if (/sales|marketing/i.test(category)) return 'Revenue Generation';
  if (/finance|bfsi|bank/i.test(category)) return 'Finance';
  if (/hr|recruit/i.test(category)) return 'HR';
  if (/operation|logistic|supply/i.test(category)) return 'Operations';
  if (/(^|[^a-z])it([^a-z]|$)|computer|software|data/i.test(category)) return 'IT';
  return null;
}

/** Vertex: whether a role category is a tech job. */
export const isTechRole = (category: string | null) =>
  Boolean(
    category &&
      /(^|[^a-z])it([^a-z]|$)|computer|software|data|engineering|electronic/i.test(category)
  );

/**
 * A management student's specialisation: every student takes Revenue Generation, and some
 * also a second domain (Finance, HR, IT, Operations), which is then theirs.
 */
function specialisation(subjects: string[]): string | null {
  const domains = new Set<string>();
  for (const subject of subjects) {
    if (/boot\s*camp/i.test(subject)) continue;
    const found = DOMAINS.find(([pattern]) => pattern.test(subject));
    if (found) domains.add(found[1]);
  }
  const other = [...domains].find((domain) => domain !== 'Revenue Generation');
  return other ?? (domains.size ? 'Revenue Generation' : null);
}

const num = (value: unknown) => (value == null || value === '' ? null : Number(value));

/** Every in-season student, with their measures and offers. Made for everyone at once. */
export async function placementRows(): Promise<{
  students: StudentRow[];
  syncedAt: string | null;
}> {
  const converge = currentApp() === 'converge';
  // Batches with any offers, so only those students are worked out.
  const studentsQuery = db()`
    with season as (
      select s.program, s.admission_year from placements p
      join students s using (lms_user_id) where s.on_platform
      group by 1, 2 having count(distinct p.lms_user_id) >= ${SEASON_MIN})
    select s.lms_user_id, s.username, s.name, s.campus_id, s.campus, s.program, s.admission_year,
      (select coalesce(array_agg(c.cohort order by c.cohort_id), '{}') from student_cohorts c
        where c.lms_user_id = s.lms_user_id) as cohorts
    from students s join season using (program, admission_year)
    where s.on_platform`;
  const offersQuery = db()`
    select p.*, p.selected_on::text as selected, p.joining_on::text as joining_date
    from placements p join students s using (lms_user_id) where s.on_platform
    order by p.selected_on`;
  // Vertex: problems solved across the coding platforms (GitHub counts contributions, not
  // problems, so it is left out). Students without any username have no number.
  const extraQuery = converge
    ? db()`
        select ss.lms_user_id, array_agg(distinct c.name) as subjects
        from lms_section_students ss
        join lms_course_sections cs using (section_id)
        join lms_courses c on c.id = cs.course_id
        where c.name ~* 'prime domain'
        group by ss.lms_user_id`
    : db()`
        select s.lms_user_id, sum((ps.summary->>'value')::int)::int as solved
        from students s
        cross join lateral (values ('leetcode', s.leetcode), ('geeksforgeeks', s.geeksforgeeks),
          ('hackerrank', s.hackerrank), ('codeforces', s.codeforces), ('codechef', s.codechef)) h(platform, handle)
        join platform_stats ps on ps.platform = h.platform and ps.handle = h.handle
        where s.on_platform and h.handle <> '' and not (h.platform = any(s.invalid_handles))
          and ps.summary->>'value' ~ '^[0-9]+$'
        group by s.lms_user_id`;
  const syncQuery = db()`select ran_at::text as ran_at from sync_state where name = 'placements'`;
  const [[students, offers, extra, synced], { byCampus }] = await Promise.all([
    together([studentsQuery, offersQuery, extraQuery, syncQuery]),
    metricsByCampus(),
  ]);

  const metrics: Record<string, Record<string, unknown>> = Object.assign(
    {},
    ...Object.values(byCampus)
  );
  const extraBy = new Map(extra.map((row) => [Number(row.lms_user_id), row]));
  const offersBy = new Map<number, Offer[]>();
  for (const row of offers) {
    const list = offersBy.get(Number(row.lms_user_id)) ?? [];
    list.push({
      company: row.company,
      designation: row.designation,
      category: row.category,
      fullTime: Boolean(row.full_time),
      totalLpa: num(row.total_lpa),
      fixedLpa: num(row.fixed_lpa),
      stipend: num(row.stipend),
      months: num(row.months),
      selectedOn: row.selected ?? null,
      joining: num(row.joining_status),
      joiningOn: row.joining_date ?? null,
      withdrawn: Boolean(row.withdrawn),
      withdrawnReason: row.withdrawn_reason,
      crc: row.crc,
    });
    offersBy.set(Number(row.lms_user_id), list);
  }

  const rows: StudentRow[] = students.map((row) => {
    const id = Number(row.lms_user_id);
    const m = (metrics[String(row.username)] ?? {}) as Record<string, any>;
    const sittings = Array.isArray(m.amcat) ? (m.amcat as [string, number][]) : [];
    const amcat = sittings.length ? Number(sittings[sittings.length - 1][1]) : null;
    const more = extraBy.get(id);
    const measures: Record<string, number | null> = converge
      ? {
          domain: num(m.domain_avg ?? m.test_avg),
          elq: num(m.elq_avg),
          amcat,
          attendance: num(m.attendance),
          exams: num(m.exam_avg),
        }
      : {
          tests: num(m.test_avg),
          solved: num(more?.solved),
          amcat,
          attendance: num(m.attendance),
          exams: num(m.exam_avg),
        };
    return {
      slug: String(row.username),
      name: String(row.name),
      campusId: row.campus_id == null ? null : Number(row.campus_id),
      campus: String(row.campus ?? ''),
      program: String(row.program ?? ''),
      year: num(row.admission_year),
      cohorts: (row.cohorts as string[]) ?? [],
      domain: converge ? specialisation((more?.subjects as string[]) ?? []) : null,
      measures,
      offers: offersBy.get(id) ?? [],
    };
  });
  return { students: rows, syncedAt: synced[0] ? String(synced[0].ran_at) : null };
}

export const placementRowsSnapshot = (context?: WaitUntil) =>
  snapshot('placements', placementRows, context);

// ---------------------------------------------------------------------------------------------

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value * 100) / 100;
};
const mean = (values: number[]) =>
  values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : null;
const pct = (part: number, whole: number) =>
  whole ? Math.round((1000 * part) / whole) / 10 : null;
const present = (values: (number | null | undefined)[]) =>
  values.filter((value): value is number => value != null && Number.isFinite(value));

export interface PlacementOptions {
  kind: Kind;
  /** One campus, or every campus the viewer may see. */
  campusId?: number | null;
  /** Campus staff do not see each student's pay, only averages. */
  showPay: boolean;
}

/** The Placements page for one viewer, from the saved rows. */
export function placementReport(
  all: StudentRow[],
  viewer: Viewer,
  { kind, campusId = null, showPay }: PlacementOptions
) {
  const converge = currentApp() === 'converge';
  const measures = measuresFor();
  const fullTime = kind === 'full-time';
  const visible = all.filter(
    (row) =>
      viewer.campusIds === null ||
      (row.campusId !== null && viewer.campusIds.includes(row.campusId))
  );
  const offersOf = (row: StudentRow) => row.offers.filter((offer) => offer.fullTime === fullTime);
  /** What an offer pays: CTC in lakhs a year (full-time), or the stipend a month (internship). */
  const payOf = (offer: Offer) => (fullTime ? offer.totalLpa : offer.stipend);
  const bestPay = (row: StudentRow) => {
    const pays = present(offersOf(row).map(payOf));
    return pays.length ? Math.max(...pays) : null;
  };

  // Batches in season for this kind, among the campuses the viewer may see.
  const batchCounts = new Map<string, number>();
  for (const row of visible) {
    if (offersOf(row).length) {
      const key = `${row.program}:${row.year}`;
      batchCounts.set(key, (batchCounts.get(key) ?? 0) + 1);
    }
  }
  const inSeason = (row: StudentRow) =>
    (batchCounts.get(`${row.program}:${row.year}`) ?? 0) >= SEASON_MIN;
  const seasonAll = visible.filter(inSeason);
  const campuses = [
    ...new Map(
      seasonAll.filter((row) => row.campusId !== null).map((row) => [row.campusId, row.campus])
    ),
  ]
    .map(([id, name]) => ({ id: id as number, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const population =
    campusId === null ? seasonAll : seasonAll.filter((row) => row.campusId === campusId);
  const placed = population.filter((row) => offersOf(row).length);
  const placedSet = new Set(placed);
  const offers = placed.flatMap((row) => offersOf(row).map((offer) => ({ row, offer })));

  const groupStats = (rows: StudentRow[]) => {
    const got = rows.filter((row) => placedSet.has(row));
    const pays = present(got.map(bestPay));
    return {
      students: rows.length,
      placed: got.length,
      rate: pct(got.length, rows.length),
      medianPay: median(pays),
      highestPay: pays.length ? Math.max(...pays) : null,
    };
  };
  const groupBy = <K>(rows: StudentRow[], key: (row: StudentRow) => K) => {
    const groups = new Map<K, StudentRow[]>();
    for (const row of rows) {
      const k = key(row);
      groups.set(k, [...(groups.get(k) ?? []), row]);
    }
    return groups;
  };

  const readinessKeys = measures.filter((m) => m.readiness).map((m) => m.key);
  // The average of a student's percentage measures; two at least, so one exam alone does not
  // make a student look ready.
  const readiness = (row: StudentRow) => {
    const values = present(readinessKeys.map((key) => row.measures[key]));
    return values.length >= 2 ? mean(values) : null;
  };

  // How placed students prepared, against those without an offer yet, and the placement rate
  // in each quarter of the batch on each measure.
  const prep = measures.map((measure) => {
    const scored = population.filter((row) => row.measures[measure.key] != null);
    const valueOf = (row: StudentRow) => row.measures[measure.key] as number;
    const yes = scored.filter((row) => placedSet.has(row));
    const no = scored.filter((row) => !placedSet.has(row));
    let bands: {
      label: string;
      from: number;
      to: number;
      students: number;
      placed: number;
      rate: number | null;
      medianPay: number | null;
    }[] = [];
    if (scored.length >= 20) {
      const sorted = [...scored].sort((a, b) => valueOf(a) - valueOf(b));
      bands = ['Bottom quarter', 'Second quarter', 'Third quarter', 'Top quarter'].map(
        (label, index) => {
          const slice = sorted.slice(
            Math.floor((index * sorted.length) / 4),
            Math.floor(((index + 1) * sorted.length) / 4)
          );
          const stats = groupStats(slice);
          return {
            label,
            from: valueOf(slice[0]),
            to: valueOf(slice[slice.length - 1]),
            students: stats.students,
            placed: stats.placed,
            rate: stats.rate,
            medianPay: stats.medianPay,
          };
        }
      );
    }
    return {
      key: measure.key,
      placedAvg: mean(yes.map(valueOf)),
      othersAvg: mean(no.map(valueOf)),
      placedCount: yes.length,
      othersCount: no.length,
      bands,
    };
  });

  const roles = (() => {
    const byCategory = new Map<string, { offers: number; pays: number[]; rows: Set<StudentRow> }>();
    for (const { row, offer } of offers) {
      const category = offer.category ?? 'Not given';
      const entry = byCategory.get(category) ?? { offers: 0, pays: [], rows: new Set() };
      entry.offers++;
      const pay = payOf(offer);
      if (pay != null) entry.pays.push(pay);
      entry.rows.add(row);
      byCategory.set(category, entry);
    }
    return [...byCategory]
      .map(([category, entry]) => ({
        category,
        offers: entry.offers,
        medianPay: median(entry.pays),
        measures: Object.fromEntries(
          measures.map((m) => [
            m.key,
            mean(present([...entry.rows].map((row) => row.measures[m.key]))),
          ])
        ),
      }))
      .sort((a, b) => b.offers - a.offers);
  })();

  const companies = [
    ...offers.reduce((map, { offer }) => {
      const name = offer.company ?? 'Not given';
      const entry = map.get(name) ?? { offers: 0, pays: [] as number[] };
      entry.offers++;
      const pay = payOf(offer);
      if (pay != null) entry.pays.push(pay);
      return map.set(name, entry);
    }, new Map<string, { offers: number; pays: number[] }>()),
  ]
    .map(([company, entry]) => ({ company, offers: entry.offers, medianPay: median(entry.pays) }))
    .sort((a, b) => b.offers - a.offers || (b.medianPay ?? 0) - (a.medianPay ?? 0))
    .slice(0, 15);

  const months = [
    ...offers.reduce((map, { offer }) => {
      const month = offer.selectedOn?.slice(0, 7);
      return month ? map.set(month, (map.get(month) ?? 0) + 1) : map;
    }, new Map<string, number>()),
  ]
    .map(([month, count]) => ({ month, offers: count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const joining = [
    ...offers.reduce((map, { offer }) => {
      const key = offer.withdrawn ? 'withdrawn' : offer.joining ? String(offer.joining) : 'unknown';
      return map.set(key, (map.get(key) ?? 0) + 1);
    }, new Map<string, number>()),
  ]
    .map(([key, count]) => ({
      key,
      label:
        key === 'withdrawn'
          ? 'Offer withdrawn'
          : key === 'unknown'
            ? 'Not updated yet'
            : (JOINING[Number(key)] ?? key),
      offers: count,
    }))
    .sort((a, b) => b.offers - a.offers);

  const byCampus = [...groupBy(population, (row) => row.campusId)]
    .map(([id, rows]) => ({ id, name: rows[0].campus, ...groupStats(rows) }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.placed - a.placed);
  const batches = [...groupBy(population, (row) => `${row.program}:${row.year}`)]
    .map(([, rows]) => ({ program: rows[0].program, year: rows[0].year, ...groupStats(rows) }))
    .sort((a, b) => a.program.localeCompare(b.program) || (a.year ?? 0) - (b.year ?? 0));

  // LMS cohorts (Super 100 and others) against everyone else.
  const cohortNames = [...new Set(population.flatMap((row) => row.cohorts))].sort();
  const cohorts = [
    ...cohortNames.map((cohort) => ({
      cohort,
      ...groupStats(population.filter((row) => row.cohorts.includes(cohort))),
    })),
    ...(cohortNames.length
      ? [
          {
            cohort: 'Not in a cohort',
            ...groupStats(population.filter((row) => !row.cohorts.length)),
          },
        ]
      : []),
  ];

  // Converge: does the job match the domain the student specialised in? Vertex: tech jobs
  // against the rest, and how those students practised.
  let fit: unknown = null;
  if (converge) {
    const cells = new Map<string, number>();
    const columns = new Set<string>();
    const rowsOf = new Map<string, { offers: number; matched: number }>();
    for (const { row, offer } of offers) {
      const domain = row.domain ?? 'Not known';
      const role = domainOfRole(offer.category) ?? 'General roles';
      columns.add(role);
      cells.set(`${domain}|${role}`, (cells.get(`${domain}|${role}`) ?? 0) + 1);
      const entry = rowsOf.get(domain) ?? { offers: 0, matched: 0 };
      entry.offers++;
      if (role === domain) entry.matched++;
      rowsOf.set(domain, entry);
    }
    const order = [
      'Revenue Generation',
      'Finance',
      'HR',
      'IT',
      'Operations',
      'General roles',
      'Not known',
    ];
    const sort = (list: string[]) => list.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    fit = {
      columns: sort([...columns]),
      rows: sort([...rowsOf.keys()]).map((domain) => ({
        domain,
        offers: rowsOf.get(domain)!.offers,
        matched: rowsOf.get(domain)!.matched,
        rate: pct(rowsOf.get(domain)!.matched, rowsOf.get(domain)!.offers),
        cells: Object.fromEntries(
          [...columns].map((column) => [column, cells.get(`${domain}|${column}`) ?? 0])
        ),
      })),
    };
  } else {
    fit = [true, false].map((tech) => {
      const picked = offers.filter(({ offer }) => isTechRole(offer.category) === tech);
      const rows = [...new Set(picked.map((o) => o.row))];
      return {
        group: tech ? 'Tech roles' : 'Other roles',
        offers: picked.length,
        students: rows.length,
        medianPay: median(present(picked.map(({ offer }) => payOf(offer)))),
        measures: Object.fromEntries(
          measures.map((m) => [m.key, mean(present(rows.map((row) => row.measures[m.key])))])
        ),
      };
    });
  }

  const brief = (row: StudentRow) => ({
    slug: row.slug,
    name: row.name,
    campus: row.campus,
    program: row.program,
    year: row.year,
    super100: row.cohorts.some((cohort) => /super[\s-]*100/i.test(cohort)),
    readiness: readiness(row),
    measures: row.measures,
  });
  const waiting = population
    .filter((row) => !placedSet.has(row))
    .map(brief)
    .filter((row) => row.readiness != null);
  // Well prepared and still without an offer: put them in front of companies first.
  const ready = [...waiting].sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0)).slice(0, 25);
  // Weakest preparation and no offer: they need help now.
  const needHelp = [...waiting]
    .sort((a, b) => (a.readiness ?? 0) - (b.readiness ?? 0))
    .slice(0, 25);

  const allPays = present(placed.map(bestPay));
  const joined = offers.filter(({ offer }) => !offer.withdrawn && offer.joining === 1).length;
  const awaiting = offers.filter(({ offer }) => !offer.withdrawn && offer.joining === 3).length;
  const dropped = offers.filter(
    ({ offer }) => offer.withdrawn || (offer.joining != null && ![1, 3].includes(offer.joining))
  ).length;

  return {
    kind,
    measures,
    campuses,
    totals: {
      students: population.length,
      placed: placed.length,
      offers: offers.length,
      rate: pct(placed.length, population.length),
      medianPay: median(allPays),
      averagePay: mean(allPays),
      highestPay: allPays.length ? Math.max(...allPays) : null,
      companies: new Set(offers.map(({ offer }) => offer.company)).size,
      joined,
      awaiting,
      dropped,
    },
    batches,
    byCampus,
    roles,
    companies,
    months,
    joining,
    cohorts,
    fit,
    prep,
    ready,
    needHelp,
    offers: offers
      .map(({ row, offer }) => ({
        ...brief(row),
        company: offer.company,
        designation: offer.designation,
        category: offer.category,
        pay: showPay ? payOf(offer) : null,
        months: offer.months,
        selectedOn: offer.selectedOn,
        joining: offer.withdrawn
          ? `Withdrawn${offer.withdrawnReason ? `: ${offer.withdrawnReason}` : ''}`
          : offer.joining
            ? (JOINING[offer.joining] ?? null)
            : null,
        crc: offer.crc,
      }))
      .sort((a, b) => (b.selectedOn ?? '').localeCompare(a.selectedOn ?? '')),
    showPay,
  };
}

export type PlacementReport = ReturnType<typeof placementReport>;
