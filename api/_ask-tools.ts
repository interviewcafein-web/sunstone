// What Ask Vertex can look up: the same numbers as the website's pages, through the same
// functions, limited to the campuses the signed-in person may see. The AI picks a tool and
// its arguments; this code checks access and runs it. Results are kept small (the free AI
// allowance counts every word), and never carry contact details.

import type { Viewer } from './_auth';
import { db } from './_db';
import type { ToolSpec } from './_ai';
import { campus, campuses, metrics, student } from './assessments';
import { listStudents } from './_roster';
import { cohortLabel } from '../src/lib/cohorts';
import {
  DIMENSIONS,
  buildInsights,
  findPainPoints,
  groupBy,
  groupStats,
  type StudentInsight,
} from '../src/lib/insights';
import type { PlatformSummary } from '../src/lib/coding-profiles/summaries';

type Args = Record<string, unknown>;
type Result = Record<string, unknown>;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && value.trim() && Number.isFinite(Number(value))
      ? Number(value)
      : undefined;
const pct = (part: number, whole: number) => (whole ? Math.round((100 * part) / whole) : null);
const day = (value: unknown) => (value ? String(value).slice(0, 10) : null);

/** "midterm_1:2026-2" → "Midterm 1 · Jul–Dec 2026" (as on the website). */
function examEvent(event: string) {
  const [type, term] = event.split(':');
  const midterm = type.match(/^midterm_(\d+)$/);
  const name = midterm ? `Midterm ${midterm[1]}` : type === 'endterm' ? 'End-term' : 'Other exams';
  const half = term?.match(/^(\d{4})-([12])$/);
  return half ? `${name} · ${half[2] === '2' ? 'Jul–Dec' : 'Jan–Jun'} ${half[1]}` : name;
}

// --- Campuses and batches the person may see --------------------------------------------

interface CampusInfo {
  id: number;
  name: string;
  code: string | null;
  students: number;
  batches: { program: string; year: number; students: number }[];
}

export class Context {
  private campusList?: Promise<CampusInfo[]>;
  private rows?: Promise<StudentInsight[]>;
  constructor(readonly viewer: Viewer) {}

  campuses(): Promise<CampusInfo[]> {
    this.campusList ??= db()
      .query(
        `select s.campus_id as id, min(s.campus) as name, min(trim(c.code)) as code,
                s.program, s.admission_year as year, count(*)::int as students
         from students s left join campuses c on c.id = s.campus_id
         where s.on_platform and s.campus_id is not null
           and ($1::int[] is null or s.campus_id = any($1::int[]))
         group by s.campus_id, s.program, s.admission_year`,
        [this.viewer.campusIds]
      )
      .then((rows) => {
        const byId = new Map<number, CampusInfo>();
        for (const row of rows) {
          const id = Number(row.id);
          const entry = byId.get(id) ?? {
            id,
            name: String(row.name),
            code: row.code ? String(row.code) : null,
            students: 0,
            batches: [],
          };
          entry.students += Number(row.students);
          if (row.program && row.year) {
            entry.batches.push({
              program: String(row.program),
              year: Number(row.year),
              students: Number(row.students),
            });
          }
          byId.set(id, entry);
        }
        return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
      });
    return this.campusList;
  }

  /** Every student the person may see, scored on the five fronts (the 360° model). */
  insightRows(): Promise<StudentInsight[]> {
    this.rows ??= Promise.all([
      listStudents(this.viewer),
      metrics(this.viewer),
      db()`select platform, handle, summary from platform_stats where summary is not null`,
    ]).then(([students, { students: perStudent }, summaries]) => {
      const byHandle = new Map(
        summaries.map((row) => [`${row.platform}:${row.handle}`, row.summary as PlatformSummary])
      );
      return buildInsights(students, perStudent as never, (platform, handle) =>
        byHandle.get(`${platform}:${handle}`)
      );
    });
    return this.rows;
  }

  /** A campus by name or short code ("SAGE", "Sage University"), among those visible. */
  async findCampus(query: string): Promise<CampusInfo | { error: string }> {
    const list = await this.campuses();
    const wanted = query
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!wanted) return { error: 'Say which campus.' };
    const byCode = list.filter((item) => item.code && item.code.toLowerCase() === wanted);
    if (byCode.length === 1) return byCode[0];
    const tokens = wanted.split(' ').filter((token) => token.length > 1);
    const matches = list.filter((item) => {
      const name = item.name.toLowerCase();
      return name.includes(wanted) || tokens.every((token) => name.includes(token));
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      return {
        error: `Several campuses match "${query}": ${matches.map((item) => item.name).join('; ')}.`,
      };
    }
    return {
      error: `No campus you can see matches "${query}". Campuses you can see: ${list
        .map((item) => `${item.name}${item.code ? ` (${item.code})` : ''}`)
        .join('; ')}.`,
    };
  }
}

/** A program name as stored ("btech" → "B.Tech"), from the programs the person can see. */
async function programOf(context: Context, value: unknown) {
  const wanted = text(value)
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!wanted) return undefined;
  const programs = new Set(
    (await context.campuses()).flatMap((item) => item.batches.map((b) => b.program))
  );
  return (
    [...programs].find((program) => program.toLowerCase().replace(/[^a-z]/g, '') === wanted) ??
    text(value)
  );
}

/** The website's batch filter: "B.Tech:2025", "B.Tech:", "2025" or null. */
const batchFilter = (program?: string, year?: number) =>
  program && year ? `${program}:${year}` : program ? `${program}:` : year ? String(year) : null;

const scopeArgs = {
  campus: {
    type: 'string',
    description: 'Campus name or short code, e.g. "SAGE" or "Assam Down Town University".',
  },
  program: { type: 'string', description: 'Optional program: B.Tech, BCA, MCA, BE…' },
  year: {
    type: 'integer',
    description: 'Optional admission year of the batch, e.g. 2025 (B.Tech 2025–29).',
  },
};

async function scopeOf(context: Context, args: Args, campusRequired: boolean) {
  const program = await programOf(context, args.program);
  const year = num(args.year);
  let found: CampusInfo | null = null;
  if (text(args.campus)) {
    const match = await context.findCampus(text(args.campus));
    if ('error' in match) return { error: match.error };
    found = match;
  } else if (campusRequired) {
    const list = await context.campuses();
    if (list.length === 1) found = list[0];
    else return { error: 'Say which campus.' };
  }
  const label = [
    found?.name ?? 'All Campuses',
    program && year
      ? cohortLabel(program, year)
      : program
        ? `All ${program}`
        : year
          ? `Batch ${year}`
          : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { campus: found, program, year, batch: batchFilter(program, year), label };
}

// --- The tools ---------------------------------------------------------------------------

export const TOOL_SPECS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'list_campuses',
      description:
        'All campuses the person can see, with students, batches, PRIME Mock Test average and participation, and attendance. Use to compare campuses or find a campus name.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'campus_report',
      description:
        'One campus (optionally one batch): students, PRIME Mock Tests, attendance (all classes and PRIME), AMCAT rounds, internal exams, PRIME coding delivery against allocated hours (from the delivery tracker) with trainers and classes not logged yet.',
      parameters: { type: 'object', properties: scopeArgs, required: ['campus'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delivery_by_campus',
      description:
        'PRIME coding domain delivery for every campus: allocated hours, verified, awaiting verification, % verified, last class. Use to compare campuses on syllabus delivery.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_students',
      description:
        'Students matching filters, sorted, up to 25 (with the total count). Scores: coding = best solved count, attendance %, PRIME Mock Test average %, latest AMCAT score, internal exam average %.',
      parameters: {
        type: 'object',
        properties: {
          ...scopeArgs,
          attendance_below: { type: 'number' },
          mock_tests_below: { type: 'number' },
          amcat_below: { type: 'number' },
          exams_below: { type: 'number' },
          coding_solved_below: { type: 'number' },
          at_risk_fronts_at_least: {
            type: 'integer',
            description: 'Students at risk on at least this many of the five fronts.',
          },
          sort_by: {
            type: 'string',
            enum: ['overall', 'coding', 'attendance', 'mock_tests', 'amcat', 'exams'],
          },
          order: { type: 'string', enum: ['lowest', 'highest'] },
          limit: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'student_profile',
      description:
        'One student by name: five fronts, recent PRIME Mock Tests, attendance, AMCAT, exams, coding.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' }, campus: scopeArgs.campus },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pain_points',
      description:
        'What needs attention for all campuses, one campus or one batch, most pressing first (as on the 360° view), with the five fronts averages.',
      parameters: { type: 'object', properties: scopeArgs },
    },
  },
];

const FRONT_KEYS = {
  coding: 'coding',
  attendance: 'attendance',
  mock_tests: 'tests',
  amcat: 'amcat',
  exams: 'exams',
} as const;

const scoresOf = (row: StudentInsight) => ({
  coding_solved: row.solved,
  attendance_pct: row.scores.attendance,
  mock_tests_pct: row.scores.tests,
  amcat: row.scores.amcat,
  exams_pct: row.scores.exams,
});

async function listCampusesTool(context: Context): Promise<Result> {
  const [{ campuses: rows, syncedAt }, info] = await Promise.all([
    campuses(context.viewer),
    context.campuses(),
  ]);
  const batchesOf = new Map(info.map((item) => [item.id, item.batches]));
  return {
    data_as_of: syncedAt,
    campuses: (rows as Record<string, unknown>[]).map((row) => ({
      name: row.name,
      students: row.students,
      batches: (batchesOf.get(Number(row.id)) ?? [])
        .sort((a, b) => b.year - a.year)
        .map((b) => cohortLabel(b.program, b.year)),
      mock_tests_released: row.tests,
      mock_tests_average_pct: row.avg_pct,
      mock_tests_participation_pct: pct(Number(row.submissions), Number(row.expected)),
      attendance_pct: row.attendance_pct,
      link: `/campuses?campus=${row.id}`,
    })),
  };
}

async function campusReportTool(context: Context, args: Args): Promise<Result> {
  const scope = await scopeOf(context, args, true);
  if ('error' in scope) return scope;
  const found = scope.campus!;
  const data = await campus(found.id, scope.batch);
  const attendance = data.attendance as Record<string, any>;
  const delivery = data.delivery as Record<string, any> | null;
  const summary = data.summary;
  return {
    scope: scope.label,
    link: `/campuses?campus=${found.id}${scope.batch ? `&batch=${encodeURIComponent(scope.batch)}` : ''}`,
    data_as_of: data.syncedAt,
    students: summary.students,
    prime_mock_tests: {
      released: summary.tests,
      scheduled: summary.scheduled,
      average_score_pct: summary.avg_pct,
      participation_pct: pct(summary.submissions, summary.expected),
    },
    attendance: {
      all_classes_pct: attendance.pct,
      prime_classes_pct: attendance.prime_pct,
      last_weeks_pct: (attendance.weeks as { week: string; pct: number }[])
        .slice(-4)
        .map((week) => `${week.week}: ${week.pct}%`),
      lowest_subjects: (attendance.subjects as { subject: string; pct: number }[])
        .filter((subject) => subject.pct !== null)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 3)
        .map((subject) => `${subject.subject}: ${subject.pct}%`),
      prime_coding_instructors: (attendance.faculty as Record<string, unknown>[])
        .slice(0, 6)
        .map((person) => ({
          name: person.faculty,
          classes: person.sessions,
          attendance_pct: person.pct,
        })),
    },
    amcat_rounds: (data.amcat.rounds as Record<string, unknown>[]).slice(0, 4).map((round) => ({
      name: round.test_name,
      students: round.students,
      average_score: round.avg_score,
      last_taken: day(round.last_at),
    })),
    internal_exams: (data.exams.events as Record<string, unknown>[]).slice(0, 4).map((event) => ({
      event: examEvent(String(event.event)),
      kind: event.kind,
      average_pct: event.avg_pct,
      pass_pct: event.pass_pct,
      students: event.students,
    })),
    delivery: delivery
      ? {
          allocated_hours: delivery.allocated,
          verified_hours: delivery.delivered,
          awaiting_verification_hours: delivery.pending,
          still_to_go_hours: Math.max(
            0,
            delivery.allocated - delivery.delivered - delivery.pending
          ),
          verified_pct: pct(delivery.delivered, delivery.allocated),
          verified_classes: delivery.classes,
          problems_solved: delivery.problems,
          last_class: delivery.last_class,
          sections_furthest_behind: (delivery.sections as Record<string, number & string>[])
            .filter((row) => Number(row.allocated) > 0)
            .map((row) => ({
              section: `${cohortLabel(String(row.program), Number(row.batch_year))}${row.section ? ` · ${row.section}` : ''}`,
              verified: Number(row.delivered),
              allocated: Number(row.allocated),
              pct: pct(Number(row.delivered), Number(row.allocated)),
            }))
            .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
            .slice(0, 5),
          trainers: (delivery.trainers as Record<string, unknown>[]).map((trainer) => ({
            name: trainer.name,
            verified_hours: trainer.hours,
            awaiting_hours: trainer.pending_hours,
            classes: trainer.classes,
            problems_solved: trainer.problems,
            attendance_pct: trainer.attendance,
            last_logged: trainer.last_logged,
            rejected_entries: trainer.rejected,
          })),
          classes_not_logged_yet: delivery.unlogged
            ? {
                classes: delivery.unlogged.classes,
                of_lms_classes: delivery.unlogged.checked,
                by_trainer: delivery.unlogged.trainers,
              }
            : null,
        }
      : 'No PRIME coding delivery recorded in the tracker for this selection.',
    batches: data.batches.map((b) => cohortLabel(b.program, b.year)),
  };
}

async function deliveryByCampusTool(context: Context): Promise<Result> {
  const info = await context.campuses();
  const byCode = new Map(
    info.filter((item) => item.code).map((item) => [item.code!.toUpperCase(), item])
  );
  const [targets, classes] = await Promise.all([
    db()`select campus_code, sum(allocated_hours)::int as allocated from dlv_targets group by 1`,
    db()`select campus_code,
           round(coalesce(sum(minutes) filter (where status = 'VERIFIED' and minutes between 1 and 600), 0) / 60.0)::int as verified,
           round(coalesce(sum(minutes) filter (where status = 'PENDING VERIFICATION' and minutes between 1 and 600), 0) / 60.0)::int as pending,
           max(class_date) filter (where status = 'VERIFIED')::text as last_class
         from dlv_classes_counted group by 1`,
  ]);
  const done = new Map(classes.map((row) => [String(row.campus_code).toUpperCase(), row]));
  return {
    campuses: targets
      .filter((row) => byCode.has(String(row.campus_code).toUpperCase()))
      .map((row) => {
        const item = byCode.get(String(row.campus_code).toUpperCase())!;
        const progress = done.get(String(row.campus_code).toUpperCase());
        return {
          campus: item.name,
          allocated_hours: Number(row.allocated),
          verified_hours: Number(progress?.verified ?? 0),
          awaiting_hours: Number(progress?.pending ?? 0),
          verified_pct: pct(Number(progress?.verified ?? 0), Number(row.allocated)),
          last_class: progress?.last_class ?? null,
          link: `/campuses?campus=${item.id}`,
        };
      })
      .sort((a, b) => (a.verified_pct ?? 0) - (b.verified_pct ?? 0)),
  };
}

async function scopedRows(
  context: Context,
  scope: { campus: CampusInfo | null; program?: string; year?: number }
) {
  return (await context.insightRows()).filter(
    (row) =>
      (!scope.campus || row.student.campus === scope.campus.name) &&
      (!scope.program || row.student.course === scope.program) &&
      (!scope.year || row.student.batch === String(scope.year))
  );
}

async function findStudentsTool(context: Context, args: Args): Promise<Result> {
  const scope = await scopeOf(context, args, false);
  if ('error' in scope) return scope;
  const below: [keyof typeof FRONT_KEYS | 'coding_solved', number | undefined][] = [
    ['attendance', num(args.attendance_below)],
    ['mock_tests', num(args.mock_tests_below)],
    ['amcat', num(args.amcat_below)],
    ['exams', num(args.exams_below)],
    ['coding_solved', num(args.coding_solved_below)],
  ];
  const riskAtLeast = num(args.at_risk_fronts_at_least);
  const valueOf = (row: StudentInsight, front: string) =>
    front === 'overall'
      ? row.overall
      : front === 'coding_solved' || front === 'coding'
        ? row.solved
        : row.scores[FRONT_KEYS[front as keyof typeof FRONT_KEYS]];
  let rows = (await scopedRows(context, scope)).filter((row) =>
    below.every(([front, limit]) => {
      if (limit === undefined) return true;
      const value = valueOf(row, front);
      return value !== null && value !== undefined && value < limit;
    })
  );
  if (riskAtLeast !== undefined) rows = rows.filter((row) => row.risks.length >= riskAtLeast);
  const sortBy =
    text(args.sort_by) || below.find(([, limit]) => limit !== undefined)?.[0] || 'overall';
  const highest = text(args.order) === 'highest';
  rows.sort((a, b) => {
    const x = valueOf(a, sortBy);
    const y = valueOf(b, sortBy);
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return highest ? y - x : x - y;
  });
  const limit = Math.min(25, Math.max(1, num(args.limit) ?? 15));
  return {
    scope: scope.label,
    link: scope.campus ? `/campuses?campus=${scope.campus.id}` : '/insights',
    matches: rows.length,
    shown: Math.min(limit, rows.length),
    students: rows.slice(0, limit).map((row) => ({
      name: row.student.name,
      campus: row.student.campus,
      batch: cohortLabel(row.student.course, row.student.batch),
      ...scoresOf(row),
      at_risk_on: row.risks.map((id) => DIMENSIONS.find((d) => d.id === id)!.label),
      link: `/s/${row.student.slug}`,
    })),
  };
}

async function studentProfileTool(context: Context, args: Args): Promise<Result> {
  const wanted = text(args.name).toLowerCase();
  if (!wanted) return { error: 'Say which student.' };
  let rows = await context.insightRows();
  if (text(args.campus)) {
    const match = await context.findCampus(text(args.campus));
    if ('error' in match) return match;
    rows = rows.filter((row) => row.student.campus === match.name);
  }
  const tokens = wanted.split(/\s+/);
  const found = rows.filter(
    (row) =>
      row.student.slug.toLowerCase() === wanted ||
      tokens.every((token) => row.student.name.toLowerCase().includes(token))
  );
  const exact = found.filter((row) => row.student.name.toLowerCase() === wanted);
  const matches = exact.length === 1 ? exact : found;
  if (!matches.length) return { error: `No student you can see is called "${args.name}".` };
  if (matches.length > 1) {
    return {
      several_students_match: matches.length,
      candidates: matches.slice(0, 8).map((row) => ({
        name: row.student.name,
        campus: row.student.campus,
        batch: cohortLabel(row.student.course, row.student.batch),
        link: `/s/${row.student.slug}`,
      })),
    };
  }
  const row = matches[0];
  const detail = await student(context.viewer, row.student.slug);
  const tests = (detail?.tests ?? []) as Record<string, unknown>[];
  const out = tests.filter((test) => test.status === 'completed' || test.status === 'live');
  const attendance = detail?.attendance.subjects as Record<string, unknown>[] | undefined;
  return {
    name: row.student.name,
    campus: row.student.campus,
    batch: cohortLabel(row.student.course, row.student.batch),
    link: `/s/${row.student.slug}`,
    data_as_of: detail?.syncedAt ?? null,
    ...scoresOf(row),
    coding_zone: row.zone,
    at_risk_on: row.risks.map((id) => DIMENSIONS.find((d) => d.id === id)!.label),
    prime_mock_tests: {
      released: out.length,
      submitted: out.filter((test) => test.submitted).length,
      latest: out.slice(0, 5).map((test) => ({
        name: test.name,
        released: day(test.released_at),
        score_pct: test.submitted ? test.pct : 'not submitted',
        class_average_pct: test.class_avg_pct,
      })),
    },
    attendance_by_subject: attendance
      ?.slice(0, 6)
      .map((subject) => `${subject.subject}: ${subject.pct}% of ${subject.sessions}`),
    amcat_sittings: ((detail?.amcat ?? []) as Record<string, unknown>[])
      .slice(0, 3)
      .map((sitting) => ({
        name: sitting.test_name,
        taken: day(sitting.taken_at),
      })),
  };
}

async function painPointsTool(context: Context, args: Args): Promise<Result> {
  const scope = await scopeOf(context, args, false);
  if ('error' in scope) return scope;
  const rows = await scopedRows(context, scope);
  if (!rows.length) return { scope: scope.label, error: 'No students in this selection.' };
  const stats = groupStats(scope.label, rows);
  const byCampus = !scope.campus;
  const groups = scope.year
    ? []
    : groupBy(rows, (row) => (byCampus ? row.student.campus : row.student.batch)).filter(
        (group) => group.students >= 5
      );
  const points = findPainPoints(stats, groups, byCampus ? 'campuses' : 'batches');
  const link = scope.campus
    ? `/campuses?campus=${scope.campus.id}${scope.batch ? `&batch=${encodeURIComponent(scope.batch)}` : ''}`
    : '/insights';
  return {
    scope: scope.label,
    link,
    students: stats.students,
    fronts: DIMENSIONS.map((d) => ({
      front: d.label,
      average: stats.dims[d.id].avg,
      students_with_data: stats.dims[d.id].n,
      at_risk: stats.dims[d.id].risk,
    })),
    pain_points: points.slice(0, 8).map((point) => ({
      severity: point.severity,
      title: point.title,
      detail: point.detail,
    })),
  };
}

const TOOLS: Record<string, (context: Context, args: Args) => Promise<Result>> = {
  list_campuses: listCampusesTool,
  campus_report: campusReportTool,
  delivery_by_campus: deliveryByCampusTool,
  find_students: findStudentsTool,
  student_profile: studentProfileTool,
  pain_points: painPointsTool,
};

export const toolNames = Object.keys(TOOLS);

/** Runs one tool for the person; a problem comes back as { error } for the AI to explain. */
export async function runTool(context: Context, name: string, args: Args): Promise<Result> {
  const tool = TOOLS[name];
  if (!tool) return { error: `Unknown tool ${name}.` };
  try {
    return await tool(context, args ?? {});
  } catch (error) {
    console.error('[ask] tool', name, error);
    return { error: 'That lookup failed. Try again.' };
  }
}
