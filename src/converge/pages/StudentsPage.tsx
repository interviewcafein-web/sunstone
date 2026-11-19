import { useMemo } from 'react';
import { Award, Building2, CalendarCheck, Crown, GraduationCap, Users } from 'lucide-react';

import { ExportButtons } from '@/components/common/ExportButtons';
import { PageLoader } from '@/components/common/PageLoader';
import type { ExportColumn } from '@/lib/exportTable';
import { useStudents } from '@/hooks/useStudents';
import { scoreTone, useStudentMetrics } from '@/lib/assessments';
import { useSession } from '@/lib/session';

import { StudentFilters } from '../components/StudentFilters';
import { StudentTable } from '../components/StudentTable';
import { Hero, HeroStat, Problem, SectionTitle, heroGrid, panel } from '../components/ui';
import { cn } from '@/lib/utils';
import { byProgram, inBatch, mean, sortRows, toRow, unique, type Row } from '../lib/rows';
import { batchLabel } from '@/lib/cohorts';
import { TRACKS, cohortDisplay, isSuper100 } from '../lib/subjects';
import { useRouteSearch, useSetSearch } from '../nav';
import type { StudentsSearch } from '../routes';

/** Every management student, with their PRIME, AMCAT, exam and attendance numbers. */
export default function StudentsPage() {
  const search = useRouteSearch<StudentsSearch>();
  const setSearch = useSetSearch<StudentsSearch>();
  const ownCampuses = useSession().data?.campuses;
  const students = useStudents();
  const metrics = useStudentMetrics();
  const sort = search.sort ?? 'name';

  const all = useMemo(() => students.data?.students ?? [], [students.data]);
  const options = useMemo(
    () => ({
      campus: unique(all.map((student) => student.campus)),
      program: unique(all.map((student) => student.course)),
      batch: unique(
        all
          .filter((student) => !search.program || student.course === search.program)
          .map((student) => student.batch && `${student.course}:${student.batch}`)
      ),
      cohort: unique(all.flatMap((student) => student.cohorts ?? [])),
    }),
    [all, search.program]
  );

  const rows = useMemo(() => {
    const needle = search.q?.trim().toLowerCase();
    const shown = all
      .filter(
        (student) =>
          (!search.campus || student.campus === search.campus) &&
          (!search.program || student.course === search.program) &&
          inBatch(student, search.batch) &&
          (!search.cohort || student.cohorts?.includes(search.cohort)) &&
          (!needle || student.name.toLowerCase().includes(needle))
      )
      .map((student) => toRow(student, metrics.data?.students[student.slug]))
      .filter((row) => !search.super || row.super100);
    return sortRows(shown, sort);
  }, [all, metrics.data, search, sort]);

  // How many students each campus has under the other filters (not the campus one).
  const { campusCounts, campusTotal } = useMemo(() => {
    const needle = search.q?.trim().toLowerCase();
    const counts: Record<string, number> = {};
    let total = 0;
    for (const student of all) {
      if (
        (!search.program || student.course === search.program) &&
        inBatch(student, search.batch) &&
        (!search.cohort || student.cohorts?.includes(search.cohort)) &&
        (!needle || student.name.toLowerCase().includes(needle)) &&
        (!search.super || isSuper100(student))
      ) {
        counts[student.campus] = (counts[student.campus] ?? 0) + 1;
        total++;
      }
    }
    return { campusCounts: counts, campusTotal: total };
  }, [all, search]);

  if (students.isPending) return <PageLoader label="Loading the student list" />;
  if (students.isError && !all.length) {
    return <Problem message={students.error.message} onRetry={() => students.refetch()} />;
  }

  const programs = byProgram(rows.map((row) => row.student));
  const scope =
    [
      search.campus,
      search.batch ? batchLabel(search.batch) : search.program,
      search.cohort && cohortDisplay(search.cohort),
      search.super && 'Super 100',
    ]
      .filter(Boolean)
      .join(' · ') ||
    (ownCampuses
      ? ownCampuses.map((campus) => campus.name).join(', ') || 'No Campus Assigned'
      : 'All Campuses');
  const loadingNumbers = metrics.isPending;

  return (
    <div className="rise-stagger space-y-5">
      <Hero
        eyebrow="Students"
        title={scope}
        aside={
          <p className="text-brand-100 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs ring-1 ring-white/15">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            {loadingNumbers ? 'Loading LMS numbers…' : 'From the Sunstone LMS, synced nightly'}
          </p>
        }
      >
        <p className="text-brand-100 relative mt-2 max-w-2xl text-sm">
          PRIME domain and communication and aptitude tests, AMCAT, internal exams and attendance
          for every BBA and MBA student in Sunstone PRIME.
        </p>
        <dl className={cn(heroGrid, 'mt-6')}>
          <HeroStat
            icon={Users}
            label="Students"
            value={rows.length}
            note={
              rows.length === all.length ? undefined : `of ${all.length.toLocaleString('en-IN')}`
            }
          />
          <HeroStat
            icon={GraduationCap}
            label="BBA · MBA"
            value={programs.BBA ?? 0}
            note={`· ${(programs.MBA ?? 0).toLocaleString('en-IN')}`}
          />
          <HeroStat
            icon={Crown}
            label="Super 100"
            value={rows.filter((row) => row.super100).length}
            gold
          />
          <HeroStat
            icon={CalendarCheck}
            label="Average Attendance"
            value={loadingNumbers ? null : mean(rows.map((row) => row.attendance))}
            suffix="%"
          />
          <HeroStat
            icon={Award}
            label="AMCAT Average"
            value={loadingNumbers ? null : mean(rows.map((row) => row.amcat))}
            note="latest sitting"
          />
        </dl>
      </Hero>

      <StudentFilters values={search} options={options} onChange={setSearch} />

      {options.campus.length > 1 && (
        <CampusSwitch
          campuses={options.campus}
          counts={campusCounts}
          total={campusTotal}
          value={search.campus}
          onChange={(campus) => setSearch({ campus })}
        />
      )}

      {!search.campus && options.campus.length > 1 && (
        <CampusBreakdown
          rows={rows}
          loading={loadingNumbers}
          scope={scope}
          onPick={(campus) => setSearch({ campus })}
        />
      )}

      {metrics.isError && (
        <Problem
          message={`${metrics.error.message} Names are listed without their numbers.`}
          onRetry={() => metrics.refetch()}
        />
      )}

      <StudentTable
        rows={rows}
        exportName={`converge-students-${scope}`}
        sort={sort}
        onSort={(next) => setSearch({ sort: next === 'name' ? undefined : next })}
      />
    </div>
  );
}

// --- Campus-wise --------------------------------------------------------------------------

/** One button per campus, to see that campus's students alone. */
function CampusSwitch({
  campuses,
  counts,
  total,
  value,
  onChange,
}: {
  campuses: string[];
  counts: Record<string, number>;
  total: number;
  value?: string;
  onChange: (campus: string | undefined) => void;
}) {
  const pill = (active: boolean) =>
    cn(
      'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition',
      active
        ? 'bg-surface text-brand-700 dark:text-brand-200 shadow-[0_1px_3px_rgb(15_23_42/0.12)] ring-1 ring-slate-200'
        : 'hover:text-brand-700 text-slate-600'
    );
  const count = (n: number) => (
    <span className="rounded-full bg-slate-200/70 px-1.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-200">
      {n.toLocaleString('en-IN')}
    </span>
  );
  return (
    <nav
      aria-label="Campus"
      className="scrollbar-none flex gap-1 overflow-x-auto rounded-full bg-slate-100/80 p-1"
    >
      <button
        type="button"
        aria-pressed={!value}
        onClick={() => onChange(undefined)}
        className={pill(!value)}
      >
        <Building2 className="size-4" aria-hidden />
        All Campuses {count(total)}
      </button>
      {campuses.map((campus) => (
        <button
          key={campus}
          type="button"
          aria-pressed={value === campus}
          onClick={() => onChange(campus)}
          className={pill(value === campus)}
        >
          {campus} {count(counts[campus] ?? 0)}
        </button>
      ))}
    </nav>
  );
}

interface CampusSummary {
  campus: string;
  students: number;
  bba: number;
  mba: number;
  super100: number;
  domain: number | null;
  comm: number | null;
  apt: number | null;
  amcat: number | null;
  tookAmcat: number;
  attendance: number | null;
  exams: number | null;
}

function summarise(rows: Row[]): CampusSummary[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows)
    groups.set(row.student.campus, [...(groups.get(row.student.campus) ?? []), row]);
  return [...groups]
    .map(([campus, list]) => ({
      campus,
      students: list.length,
      bba: list.filter((row) => row.student.course === 'BBA').length,
      mba: list.filter((row) => row.student.course === 'MBA').length,
      super100: list.filter((row) => row.super100).length,
      domain: mean(list.map((row) => row.domain)),
      comm: mean(list.map((row) => row.comm)),
      apt: mean(list.map((row) => row.apt)),
      amcat: mean(list.map((row) => row.amcat)),
      tookAmcat: list.filter((row) => row.amcat != null).length,
      attendance: mean(list.map((row) => row.attendance)),
      exams: mean(list.map((row) => row.exams)),
    }))
    .sort((a, b) => a.campus.localeCompare(b.campus));
}

const CAMPUS_COLUMNS: ExportColumn<CampusSummary>[] = [
  { header: 'Campus', value: (row) => row.campus },
  { header: 'Students', value: (row) => row.students },
  { header: 'BBA', value: (row) => row.bba },
  { header: 'MBA', value: (row) => row.mba },
  { header: 'Super 100', value: (row) => row.super100 },
  { header: 'PRIME Domain average %', value: (row) => row.domain },
  { header: 'Communication average %', value: (row) => row.comm },
  { header: 'Aptitude average %', value: (row) => row.apt },
  { header: 'Took AMCAT', value: (row) => row.tookAmcat },
  { header: 'AMCAT average (latest sitting)', value: (row) => row.amcat },
  { header: 'Attendance average %', value: (row) => row.attendance },
  { header: 'Internal exams average %', value: (row) => row.exams },
];

/** Every campus side by side, under the page's other filters; a row opens that campus. */
function CampusBreakdown({
  rows,
  loading,
  scope,
  onPick,
}: {
  rows: Row[];
  loading: boolean;
  scope: string;
  onPick: (campus: string) => void;
}) {
  const summary = useMemo(() => summarise(rows), [rows]);
  const score = (value: number | null, unit = '%') =>
    loading ? (
      <span className="text-slate-300">…</span>
    ) : value == null ? (
      <span className="text-slate-300">—</span>
    ) : (
      <span className={cn('font-semibold', unit && scoreTone(value))}>
        {value}
        {unit}
      </span>
    );
  const th = 'px-2 py-2 text-right font-semibold whitespace-nowrap';
  const td = 'px-2 py-2 text-right tabular-nums';
  return (
    <section className={cn(panel, 'p-5')}>
      <SectionTitle
        icon={Building2}
        title="By Campus"
        description="Each campus on its own: pick one to see only its students."
        aside={
          <ExportButtons
            name={`converge-students-by-campus-${scope}`}
            sheet="By campus"
            columns={CAMPUS_COLUMNS}
            rows={summary}
          />
        }
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[62rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2 font-semibold">Campus</th>
              <th className={th}>Students</th>
              <th className={th}>BBA · MBA</th>
              <th className={th}>Super 100</th>
              <th className={th}>{TRACKS.domain.label}</th>
              <th className={th}>{TRACKS.comm.label}</th>
              <th className={th}>{TRACKS.apt.label}</th>
              <th className={th}>AMCAT</th>
              <th className={th}>Attendance</th>
              <th className={th}>Internal Exams</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => (
              <tr
                key={row.campus}
                className="hover:bg-brand-50/50 dark:hover:bg-brand-900/20 cursor-pointer border-b border-slate-100 last:border-0"
                onClick={() => onPick(row.campus)}
              >
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => onPick(row.campus)}
                    className="text-brand-700 dark:text-brand-300 text-left font-semibold hover:underline"
                  >
                    {row.campus}
                  </button>
                </td>
                <td className={cn(td, 'font-semibold')}>{row.students.toLocaleString('en-IN')}</td>
                <td className={cn(td, 'text-slate-600')}>
                  {row.bba} · {row.mba}
                </td>
                <td className={td}>{row.super100 || '—'}</td>
                <td className={td}>{score(row.domain)}</td>
                <td className={td}>{score(row.comm)}</td>
                <td className={td}>{score(row.apt)}</td>
                <td className={td}>
                  {score(row.amcat, '')}
                  {!loading && row.tookAmcat > 0 && (
                    <div className="text-[11px] text-slate-400">{row.tookAmcat} took it</div>
                  )}
                </td>
                <td className={td}>{score(row.attendance)}</td>
                <td className={td}>{score(row.exams)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
