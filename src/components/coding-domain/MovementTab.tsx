// Student Performance & Cohort Movement: whether each student was employable at the AMCAT pass
// mark in an earlier cycle and in a later one (upward, downward, no movement), by program and
// by campus and batch, each student's scores across cycles, and one student's history.

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  History,
  Minus,
  Table2,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

import { ExportButtons } from '@/components/common/ExportButtons';
import { scoreTone } from '@/lib/assessments';
import {
  MOVEMENT_LABELS,
  employable,
  mockAverage,
  mockNumbers,
  movementOf,
  pct,
  type CodingStudent,
  type Cycle,
  type Movement,
} from '@/lib/codingDomain';
import { cohortLabel, compareProgram } from '@/lib/cohorts';
import type { ExportColumn } from '@/lib/exportTable';
import { cn } from '@/lib/utils';

import { AmcatScore, BRAND, Card, PlacedBadge, Title, TrackBadge, td, th } from './amcat-ui';
import { CampusRows, MiniTable, StudentGroups, compareBatch, groupBy } from './grouped';
import type { TabProps } from './types';

type Level = 'basic' | 'overall';

const MOVE_ORDER: (Movement | null)[] = ['up', 'down', 'stay-yes', 'stay-no', null];
const MOVEMENTS: {
  key: Movement;
  title: string;
  sub: string;
  icon: LucideIcon;
  tone: string;
  chip: string;
}[] = [
  {
    key: 'up',
    title: 'Upward',
    sub: 'No → Yes',
    icon: ArrowUp,
    tone: 'border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  {
    key: 'down',
    title: 'Downward',
    sub: 'Yes → No',
    icon: ArrowDown,
    tone: 'border-red-200 bg-red-50/70 text-red-700 dark:bg-red-900/20 dark:text-red-300',
    chip: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  {
    key: 'stay-yes',
    title: 'No Movement',
    sub: 'Yes → Yes',
    icon: ArrowLeftRight,
    tone: 'border-violet-200 bg-violet-50/70 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300',
    chip: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
  {
    key: 'stay-no',
    title: 'No Movement',
    sub: 'No → No',
    icon: Minus,
    tone: 'border-amber-200 bg-amber-50/70 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    chip: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
];
const MOVEMENT_OF = Object.fromEntries(MOVEMENTS.map((m) => [m.key, m])) as Record<
  Movement,
  (typeof MOVEMENTS)[number]
>;

const yesNo = (value: boolean | null) => (value === null ? '—' : value ? 'Yes' : 'No');
const batchOf = (row: CodingStudent) => cohortLabel(row.program, String(row.year ?? ''));

export default function MovementTab(props: TabProps) {
  const { students, cycles, pass, scope } = props;
  const [previousKey, setPrevious] = useState<string | undefined>();
  const [currentKey, setCurrent] = useState<string | undefined>();
  const [level, setLevel] = useState<Level>('basic');

  const current =
    cycles.find((cycle) => cycle.key === currentKey) ?? cycles[cycles.length - 1] ?? null;
  const earlier = current ? cycles.slice(0, cycles.indexOf(current)) : [];
  const previous =
    earlier.find((cycle) => cycle.key === previousKey) ?? earlier[earlier.length - 1] ?? null;

  const moves = useMemo(
    () =>
      previous && current
        ? students.map((row) => ({
            row,
            move: movementOf(row, previous.key, current.key, pass, level),
          }))
        : [],
    [students, previous, current, pass, level]
  );

  if (!students.length) {
    return (
      <Card className="border-dashed text-center">
        <p className="font-semibold text-slate-700">No Students Here</p>
        <p className="mt-1 text-sm text-slate-500">Change the filters to see cohort movement.</p>
      </Card>
    );
  }

  const select = 'bg-surface rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium';
  return (
    <>
      <Card>
        <Title
          icon={TrendingUp}
          title="Cohort Movement"
          description={`A student is in the cohort in a cycle when they are ${level === 'basic' ? 'basic employable (comms and aptitude both' : 'overall employable (comms, aptitude and domain all'} at ${pass}+ in AMCAT). Movement compares an earlier cycle with a later one.`}
          aside={
            cycles.length >= 2 && (
              <>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  Compare
                  <select
                    aria-label="Earlier cycle"
                    value={previous?.key ?? ''}
                    onChange={(event) => setPrevious(event.target.value)}
                    className={select}
                  >
                    {earlier.map((cycle) => (
                      <option key={cycle.key} value={cycle.key}>
                        {cycle.label}
                      </option>
                    ))}
                  </select>
                  →
                  <select
                    aria-label="Later cycle"
                    value={current?.key ?? ''}
                    onChange={(event) => {
                      setCurrent(event.target.value);
                      setPrevious(undefined);
                    }}
                    className={select}
                  >
                    {cycles.slice(1).map((cycle) => (
                      <option key={cycle.key} value={cycle.key}>
                        {cycle.label}
                      </option>
                    ))}
                  </select>
                </label>
                <span
                  className="flex rounded-full bg-slate-100 p-1"
                  role="group"
                  aria-label="Level"
                >
                  {(['basic', 'overall'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={level === option}
                      onClick={() => setLevel(option)}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-semibold',
                        level === option ? 'bg-surface text-brand-700 shadow' : 'text-slate-600'
                      )}
                    >
                      {option === 'basic' ? 'Basic Employable' : 'Overall Employable'}
                    </button>
                  ))}
                </span>
              </>
            )
          }
        />
        {cycles.length < 2 || !previous || !current ? (
          <p className="text-sm text-slate-500">
            Movement needs two AMCAT cycles: these students have sittings in{' '}
            {cycles.length ? `only ${cycles[0].label}` : 'no cycle yet'}.
          </p>
        ) : (
          <Summary moves={moves} previousLabel={previous.label} currentLabel={current.label} />
        )}
      </Card>

      {previous && current && moves.some((item) => item.move) && (
        <>
          <ByProgram moves={moves} scope={scope} />
          <ByBatch
            moves={moves}
            scope={scope}
            pass={pass}
            level={level}
            previous={previous}
            current={current}
            studentLink={props.studentLink}
          />
        </>
      )}

      <StudentTable
        {...props}
        moves={moves}
        previousKey={previous?.key ?? null}
        currentKey={current?.key ?? null}
        level={level}
      />
    </>
  );
}

type Moves = { row: CodingStudent; move: Movement | null }[];

function Summary({
  moves,
  previousLabel,
  currentLabel,
}: {
  moves: Moves;
  previousLabel: string;
  currentLabel: string;
}) {
  const compared = moves.filter((item) => item.move).length;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MOVEMENTS.map(({ key, title, sub, icon: Icon, tone }) => {
          const count = moves.filter((item) => item.move === key).length;
          return (
            <div key={key} className={cn('flex items-center gap-3 rounded-xl border p-4', tone)}>
              <span className="bg-surface/70 flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Icon className="size-6" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {title} <span className="font-normal opacity-80">({sub})</span>
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {count.toLocaleString('en-IN')}{' '}
                  <span className="text-base font-semibold">({pct(count, compared) ?? 0}%)</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {compared.toLocaleString('en-IN')} students compared between {previousLabel} and{' '}
        {currentLabel}; {(moves.length - compared).toLocaleString('en-IN')} not compared (did not
        sit both cycles).
      </p>
    </>
  );
}

function ByProgram({ moves, scope }: { moves: Moves; scope: string }) {
  const programs = useMemo(
    () => [...new Set(moves.filter((m) => m.move).map((m) => m.row.program))].sort(compareProgram),
    [moves]
  );
  const count = (move: Movement | null, program: string | null) =>
    moves.filter(
      (item) =>
        item.move &&
        (move === null || item.move === move) &&
        (program === null || item.row.program === program)
    ).length;
  const rows = [
    ...MOVEMENTS.map((m) => ({ label: MOVEMENT_LABELS[m.key], move: m.key as Movement | null })),
    { label: 'Total', move: null },
  ];
  type Row = (typeof rows)[number];
  const columns: ExportColumn<Row>[] = [
    { header: 'Movement', value: (row) => row.label },
    ...programs.map((program) => ({
      header: program,
      value: (row: Row) => count(row.move, program),
    })),
    { header: 'Total', value: (row) => count(row.move, null) },
  ];
  const bg: Record<string, string> = {
    up: 'bg-emerald-50/70 dark:bg-emerald-900/15',
    down: 'bg-red-50/70 dark:bg-red-900/15',
  };
  return (
    <Card>
      <Title
        icon={Table2}
        title="Cohort Movement by Program"
        aside={
          <ExportButtons
            name={`cohort-movement-by-program-${scope}`}
            sheet="Movement by program"
            columns={columns}
            rows={rows}
          />
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2 font-semibold">Movement</th>
              {programs.map((program) => (
                <th key={program} className={th}>
                  {program}
                </th>
              ))}
              <th className={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={cn(
                  'border-b border-slate-100 last:border-0',
                  row.move ? bg[row.move] : 'bg-amber-50/60 font-bold dark:bg-amber-900/10'
                )}
              >
                <td className="py-2 pr-2 pl-1 font-medium">{row.label}</td>
                {programs.map((program) => (
                  <td key={program} className={td}>
                    {count(row.move, program).toLocaleString('en-IN')}
                  </td>
                ))}
                <td className={cn(td, 'font-semibold')}>
                  {count(row.move, null).toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface BatchMoves {
  campus: string;
  program: string;
  year: number | null;
  batch: string;
  items: Moves;
  compared: number;
  up: number;
  down: number;
  stayYes: number;
  stayNo: number;
  net: number;
}

function ByBatch({
  moves,
  scope,
  pass,
  level,
  previous,
  current,
  studentLink,
}: {
  moves: Moves;
  scope: string;
  pass: number;
  level: Level;
  previous: Cycle;
  current: Cycle;
  studentLink: TabProps['studentLink'];
}) {
  const groups = useMemo(() => {
    const summarise = (list: Moves): BatchMoves => {
      const n = (move: Movement) => list.filter((item) => item.move === move).length;
      return {
        campus: list[0].row.campus,
        program: list[0].row.program,
        year: list[0].row.year,
        batch: batchOf(list[0].row),
        items: list,
        compared: list.length,
        up: n('up'),
        down: n('down'),
        stayYes: n('stay-yes'),
        stayNo: n('stay-no'),
        net: n('up') - n('down'),
      };
    };
    const compared = moves.filter((item) => item.move);
    return groupBy(compared, (item) => item.row.campus)
      .map(([campus, list]) => ({
        campus,
        total: summarise(list),
        rows: groupBy(list, (item) => `${item.row.program}|${item.row.year ?? ''}`)
          .map(([, rows]) => summarise(rows))
          .sort(compareBatch),
      }))
      .sort((a, b) => a.campus.localeCompare(b.campus));
  }, [moves]);
  const rows = groups.flatMap((group) => group.rows);
  const columns: ExportColumn<BatchMoves>[] = [
    { header: 'Campus', value: (row) => row.campus },
    { header: 'Program', value: (row) => row.program },
    { header: 'Batch', value: (row) => row.batch },
    { header: 'Compared', value: (row) => row.compared },
    { header: 'Upward', value: (row) => row.up },
    { header: 'Downward', value: (row) => row.down },
    { header: 'Yes → Yes', value: (row) => row.stayYes },
    { header: 'No → No', value: (row) => row.stayNo },
    { header: 'Net change', value: (row) => row.net },
  ];
  const scores = (item: Moves[number], key: string) => {
    const value = item.row.amcat[key];
    return (
      <span className="whitespace-nowrap">
        <AmcatScore value={value?.c} pass={pass} />
        <span className="text-slate-300"> · </span>
        <AmcatScore value={value?.a} pass={pass} />
        <span className="text-slate-300"> · </span>
        <AmcatScore value={value?.d} pass={pass} />{' '}
        <b className="text-[11px]">{yesNo(employable(value, pass, level))}</b>
      </span>
    );
  };
  return (
    <Card>
      <Title
        icon={Users}
        title="By College, Program and Batch"
        description="Net change is students who moved up less those who moved down. Open a batch to see its students."
        aside={
          <ExportButtons
            name={`cohort-movement-by-batch-${scope}`}
            sheet="Movement by batch"
            columns={columns}
            rows={rows}
          />
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2 font-semibold">College, Program and Batch</th>
              <th className={th}>Compared</th>
              <th className={th}>Upward</th>
              <th className={th}>Downward</th>
              <th className={th}>Yes → Yes</th>
              <th className={th}>No → No</th>
              <th className={th}>Net</th>
            </tr>
          </thead>
          <CampusRows
            groups={groups}
            colSpan={7}
            rowKey={(row) => `${row.program}|${row.year}`}
            label={(row) => row.batch}
            cells={(row) => (
              <>
                <td className={td}>{row.compared}</td>
                <td className={cn(td, 'text-emerald-600')}>{row.up}</td>
                <td className={cn(td, 'text-red-600')}>{row.down}</td>
                <td className={td}>{row.stayYes}</td>
                <td className={td}>{row.stayNo}</td>
                <td
                  className={cn(
                    td,
                    'font-bold',
                    row.net > 0 ? 'text-emerald-600' : row.net < 0 ? 'text-red-600' : ''
                  )}
                >
                  {row.net > 0 ? `+${row.net}` : row.net}
                </td>
              </>
            )}
            students={(row) => (
              <MiniTable
                rows={[...row.items].sort(
                  (a, b) =>
                    MOVE_ORDER.indexOf(a.move) - MOVE_ORDER.indexOf(b.move) ||
                    a.row.name.localeCompare(b.row.name)
                )}
                rowKey={(item) => item.row.slug}
                columns={[
                  {
                    header: 'Student',
                    cell: (item) =>
                      studentLink(
                        item.row.slug,
                        <span className="text-brand-700 dark:text-brand-300 font-semibold hover:underline">
                          {item.row.name}
                        </span>
                      ),
                  },
                  {
                    header: `${previous.label} (Comms · Apt · Domain · Employable)`,
                    cell: (item) => scores(item, previous.key),
                  },
                  {
                    header: `${current.label} (Comms · Apt · Domain · Employable)`,
                    cell: (item) => scores(item, current.key),
                  },
                  { header: 'Movement', cell: (item) => <MovementChip move={item.move} /> },
                ]}
              />
            )}
          />
        </table>
      </div>
    </Card>
  );
}

function MovementChip({ move }: { move: Movement | null }) {
  if (!move) return <span className="text-xs text-slate-400">Not compared</span>;
  const m = MOVEMENT_OF[move];
  const label =
    move === 'up'
      ? '▲ Upward'
      : move === 'down'
        ? '▼ Downward'
        : move === 'stay-yes'
          ? '⇄ Yes → Yes'
          : '— No → No';
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        m.chip
      )}
    >
      {label}
    </span>
  );
}

type Filter = Movement | 'all' | 'none';

function StudentTable({
  students,
  cycles,
  pass,
  scope,
  search,
  studentLink,
  moves,
  previousKey,
  currentKey,
  level,
}: TabProps & {
  moves: Moves;
  previousKey: string | null;
  currentKey: string | null;
  level: Level;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState<string | null>(null);
  const moveOf = useMemo(() => new Map(moves.map((item) => [item.row.slug, item.move])), [moves]);
  const rows = useMemo(
    () =>
      students
        .map((row) => ({ row, move: moveOf.get(row.slug) ?? null, mock: mockAverage(row) }))
        .filter(
          (item) =>
            filter === 'all' || (filter === 'none' ? item.move === null : item.move === filter)
        )
        // Upward first, then downward, the steady ones, and those not compared last.
        .sort(
          (a, b) =>
            MOVE_ORDER.indexOf(a.move) - MOVE_ORDER.indexOf(b.move) ||
            a.row.name.localeCompare(b.row.name)
        ),
    [students, moveOf, filter]
  );
  type Item = (typeof rows)[number];
  const prevLabel = cycles.find((c) => c.key === previousKey)?.label;
  const currLabel = cycles.find((c) => c.key === currentKey)?.label;
  const columns: ExportColumn<Item>[] = [
    { header: 'Name', value: (item) => item.row.name },
    { header: 'Username', value: (item) => item.row.slug },
    { header: 'Campus', value: (item) => item.row.campus },
    { header: 'Program', value: (item) => item.row.program },
    { header: 'Batch', value: (item) => batchOf(item.row) },
    { header: 'COE track', value: (item) => item.row.track },
    { header: 'LMS cohorts', value: (item) => item.row.cohorts.join(', ') },
    ...cycles.flatMap((cycle) => [
      { header: `${cycle.label} comms`, value: (item: Item) => item.row.amcat[cycle.key]?.c },
      { header: `${cycle.label} aptitude`, value: (item: Item) => item.row.amcat[cycle.key]?.a },
      { header: `${cycle.label} domain`, value: (item: Item) => item.row.amcat[cycle.key]?.d },
      {
        header: `${cycle.label} ${level} employable`,
        value: (item: Item) => yesNo(employable(item.row.amcat[cycle.key], pass, level)),
      },
    ]),
    {
      header: prevLabel && currLabel ? `Movement ${prevLabel} → ${currLabel}` : 'Movement',
      value: (item) => (item.move ? MOVEMENT_LABELS[item.move] : 'Not compared'),
    },
    { header: 'Mock test average %', value: (item) => item.mock },
    {
      header: 'Placement',
      value: (item) =>
        item.row.placed === 'full-time'
          ? 'Placed (full-time)'
          : item.row.placed === 'internship'
            ? 'Internship'
            : '',
    },
  ];
  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Everyone' },
    { key: 'up', label: '▲ Upward' },
    { key: 'down', label: '▼ Downward' },
    { key: 'stay-yes', label: '⇄ Yes → Yes' },
    { key: 'stay-no', label: '— No → No' },
    { key: 'none', label: 'Not Compared' },
  ];
  const pickedRow = picked ? students.find((row) => row.slug === picked) : undefined;
  return (
    <>
      <Card>
        <Title
          icon={Users}
          title="Student-level Performance"
          description="Each student's AMCAT skills in every cycle, whether they were employable before and after, and their mock test average. Select a student for their history."
          aside={
            <ExportButtons
              name={`student-performance-${scope}`}
              sheet="Student performance"
              columns={columns}
              rows={rows}
            />
          }
        />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold',
                filter === item.key
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'bg-surface border-slate-300 text-slate-600'
              )}
            >
              {item.label}
            </button>
          ))}
          <span className="ml-auto self-center text-xs text-slate-500">
            {rows.length.toLocaleString('en-IN')} students
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-2 font-semibold">Student</th>
                {cycles.map((cycle) => (
                  <th key={cycle.key} className="px-2 py-2 text-center font-semibold">
                    {cycle.label}
                    <div className="font-normal text-slate-400">Comms · Apt · Domain</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                  Employable
                  {prevLabel && currLabel && (
                    <div className="font-normal text-slate-400">
                      {prevLabel} → {currLabel}
                    </div>
                  )}
                </th>
                <th className="px-2 py-2 font-semibold">Movement</th>
                <th className={th}>Mock Avg</th>
              </tr>
            </thead>
            <StudentGroups
              items={rows}
              studentOf={itemStudent}
              allCampuses={!search.campus}
              colSpan={cycles.length + 4}
              summary={(list) => {
                const up = list.filter((item) => item.move === 'up').length;
                const down = list.filter((item) => item.move === 'down').length;
                return `▲ ${up} upward · ▼ ${down} downward`;
              }}
              renderRow={({ row, move, mock }) => (
                <tr
                  key={row.slug}
                  onClick={() => setPicked(row.slug === picked ? null : row.slug)}
                  className={cn(
                    'cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30',
                    picked === row.slug && 'bg-brand-50/60 dark:bg-brand-900/20'
                  )}
                >
                  <td className="py-2 pr-2">
                    <span onClick={(event) => event.stopPropagation()}>
                      {studentLink(
                        row.slug,
                        <span className="text-brand-700 dark:text-brand-300 font-semibold hover:underline">
                          {row.name}
                        </span>
                      )}
                    </span>
                    <div className="text-xs text-slate-500">
                      {row.campus} · {batchOf(row)}
                    </div>
                    {(row.track || row.placed || row.cohorts.length > 0) && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        <TrackBadge track={row.track} />
                        <PlacedBadge placed={row.placed} />
                        {row.cohorts.map((cohort) => (
                          <span
                            key={cohort}
                            className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {cohort}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  {cycles.map((cycle) => {
                    const scores = row.amcat[cycle.key];
                    return (
                      <td
                        key={cycle.key}
                        className="px-2 py-2 text-center text-xs whitespace-nowrap"
                      >
                        {scores ? (
                          <>
                            <AmcatScore value={scores.c} pass={pass} />
                            <span className="text-slate-300"> · </span>
                            <AmcatScore value={scores.a} pass={pass} />
                            <span className="text-slate-300"> · </span>
                            <AmcatScore value={scores.d} pass={pass} />
                          </>
                        ) : (
                          <span className="text-slate-300">Not taken</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center text-xs font-semibold whitespace-nowrap">
                    {previousKey && currentKey
                      ? `${yesNo(employable(row.amcat[previousKey], pass, level))} → ${yesNo(employable(row.amcat[currentKey], pass, level))}`
                      : '—'}
                  </td>
                  <td className="px-2 py-2">
                    <MovementChip move={move} />
                  </td>
                  <td className={cn(td, 'font-semibold', scoreTone(mock))}>
                    {mock == null ? '—' : `${mock}%`}
                  </td>
                </tr>
              )}
            />
          </table>
        </div>
        {!rows.length && (
          <p className="py-6 text-center text-sm text-slate-500">No students in this group.</p>
        )}
      </Card>
      {pickedRow && (
        <History_
          row={pickedRow}
          cycles={cycles}
          pass={pass}
          onClose={() => setPicked(null)}
          studentLink={studentLink}
        />
      )}
    </>
  );
}

const itemStudent = (item: { row: CodingStudent }) => item.row;

function History_({
  row,
  cycles,
  pass,
  onClose,
  studentLink,
}: {
  row: CodingStudent;
  cycles: TabProps['cycles'];
  pass: number;
  onClose: () => void;
  studentLink: TabProps['studentLink'];
}) {
  const points = cycles
    .filter((cycle) => row.amcat[cycle.key])
    .map((cycle) => ({
      cycle: cycle.label,
      Comms: row.amcat[cycle.key].c,
      Aptitude: row.amcat[cycle.key].a,
      Domain: row.amcat[cycle.key].d,
    }));
  const mocks = mockNumbers([row]);
  return (
    <Card>
      <Title
        icon={History}
        title={`Performance History: ${row.name}`}
        description={`${row.campus} · ${batchOf(row)}. AMCAT skills across cycles (pass mark ${pass}) and the LMS mock tests.`}
        aside={
          <>
            {studentLink(
              row.slug,
              <span className="text-brand-700 text-sm font-semibold hover:underline">
                Open Profile
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="size-4" />
            </button>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-56 lg:col-span-2">
          {points.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="cycle" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Comms" stroke={BRAND} strokeWidth={2} dot />
                <Line type="monotone" dataKey="Aptitude" stroke="#f59e0b" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Domain" stroke="#10b981" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">No AMCAT sittings yet.</p>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold">Mock Tests</p>
          {mocks.length ? (
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {mocks.map((n) => (
                <li key={n} className="flex justify-between py-1.5">
                  <span>AMCAT Mock Test {n}</span>
                  {row.mocks[n] == null ? (
                    <span className="text-xs text-slate-400">Not taken</span>
                  ) : (
                    <b className={scoreTone(row.mocks[n])}>{row.mocks[n]}%</b>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-500">None released yet.</p>
          )}
          <p className="mt-3 text-sm font-semibold">Placement Pipeline</p>
          <p className="mt-1 text-xs text-slate-600">
            Eligible {row.pipeline.eligible} · Applied {row.pipeline.applied} · Shortlisted{' '}
            {row.pipeline.shortlisted} · Interviews {row.pipeline.interviews}
          </p>
          {row.offers.length > 0 && (
            <ul className="mt-1 text-xs text-slate-600">
              {row.offers.map((offer, index) => (
                <li key={index}>
                  {offer.company ?? '—'}
                  {offer.role ? ` · ${offer.role}` : ''} (
                  {offer.fullTime ? 'full-time' : 'internship'})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
