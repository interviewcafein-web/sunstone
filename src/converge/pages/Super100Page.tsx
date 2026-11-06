import { useMemo } from 'react';
import {
  Award,
  Building2,
  BriefcaseBusiness,
  CalendarCheck,
  ChevronRight,
  Crown,
  GraduationCap,
  Layers,
  MessagesSquare,
  NotebookPen,
  Users,
} from 'lucide-react';

import { PageLoader } from '@/components/common/PageLoader';
import { useStudents } from '@/hooks/useStudents';
import { scoreFill, scoreTone, useStudentMetrics } from '@/lib/assessments';
import { batchLabel } from '@/lib/cohorts';
import { cn } from '@/lib/utils';

import { StudentFilters } from '../components/StudentFilters';
import { StudentTable } from '../components/StudentTable';
import { Hero, HeroStat, Problem, SectionTitle, heroGrid, panel } from '../components/ui';
import { byProgram, inBatch, mean, sortRows, toRow, unique, type Row } from '../lib/rows';
import { TRACKS, cohortDisplay, isSuper100Cohort } from '../lib/subjects';
import { attendanceFill } from '../lib/tones';
import { Link, useRouteSearch, useSetSearch } from '../nav';
import type { SuperSearch } from '../routes';

const NO_COHORT = 'No Cohort';

interface Group {
  name: string;
  rows: Row[];
  super100: boolean;
}

const METRICS: {
  key: 'domain' | 'elq' | 'amcat' | 'attendance' | 'exams';
  label: string;
  icon: typeof Award;
  unit: string;
}[] = [
  { key: 'domain', label: TRACKS.domain.label, icon: BriefcaseBusiness, unit: '%' },
  { key: 'elq', label: TRACKS.elq.label, icon: MessagesSquare, unit: '%' },
  { key: 'amcat', label: 'AMCAT, Latest', icon: Award, unit: '' },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck, unit: '%' },
  { key: 'exams', label: 'Internal Exams', icon: NotebookPen, unit: '%' },
];

/** The Super 100 cohort: who is in it, and how it compares with the other cohorts. */
export default function Super100Page() {
  const search = useRouteSearch<SuperSearch>();
  const setSearch = useSetSearch<SuperSearch>();
  const students = useStudents();
  const metrics = useStudentMetrics();
  const sort = search.sort ?? 'domain';

  const all = useMemo(
    () =>
      (students.data?.students ?? []).map((student) =>
        toRow(student, metrics.data?.students[student.slug])
      ),
    [students.data, metrics.data]
  );
  const members = useMemo(() => all.filter((row) => row.super100), [all]);

  // Every cohort present, Super 100 first, then by size; students in none last.
  const groups = useMemo<Group[]>(() => {
    const names = unique(all.flatMap((row) => row.student.cohorts ?? []));
    const list = names.map((name) => ({
      name,
      rows: all.filter((row) => row.student.cohorts?.includes(name)),
      super100: isSuper100Cohort(name),
    }));
    list.sort((a, b) => Number(b.super100) - Number(a.super100) || b.rows.length - a.rows.length);
    const none = all.filter((row) => !row.student.cohorts?.length);
    return none.length ? [...list, { name: NO_COHORT, rows: none, super100: false }] : list;
  }, [all]);

  const options = useMemo(
    () => ({
      campus: unique(members.map((row) => row.student.campus)),
      program: unique(members.map((row) => row.student.course)),
      batch: unique(
        members
          .filter((row) => !search.program || row.student.course === search.program)
          .map((row) => row.student.batch && `${row.student.course}:${row.student.batch}`)
      ),
    }),
    [members, search.program]
  );

  const rows = useMemo(() => {
    const needle = search.q?.trim().toLowerCase();
    return sortRows(
      members.filter(
        ({ student }) =>
          (!search.campus || student.campus === search.campus) &&
          (!search.program || student.course === search.program) &&
          inBatch(student, search.batch) &&
          (!needle || student.name.toLowerCase().includes(needle))
      ),
      sort
    );
  }, [members, search, sort]);

  if (students.isPending) return <PageLoader label="Loading the Super 100" />;
  if (students.isError && !all.length) {
    return <Problem message={students.error.message} onRetry={() => students.refetch()} />;
  }

  const programs = byProgram(members.map((row) => row.student));
  const campuses = unique(members.map((row) => row.student.campus));
  const loaded = Boolean(metrics.data);
  const byCampus = campuses
    .map((campus) => ({ campus, n: members.filter((row) => row.student.campus === campus).length }))
    .sort((a, b) => b.n - a.n);
  const everyone = all;

  return (
    <div className="rise-stagger space-y-5">
      <Hero
        eyebrow="Super 100"
        title={
          <span className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f3d9a4] to-[#c8913a] text-[#3b2a0c] shadow-lg">
              <Crown className="size-5.5" aria-hidden />
            </span>
            The Super 100
          </span>
        }
      >
        <p className="text-brand-100 relative mt-2 max-w-2xl text-sm">
          Students in the Super 100 opportunity cohort, with their PRIME, AMCAT, exam and attendance
          numbers, and every cohort side by side.
        </p>
        <dl className={cn(heroGrid, 'mt-6')}>
          <HeroStat icon={Crown} label="Students" value={members.length} gold />
          <HeroStat
            icon={GraduationCap}
            label="BBA · MBA"
            value={programs.BBA ?? 0}
            note={`· ${programs.MBA ?? 0}`}
          />
          <HeroStat icon={Building2} label="Campuses" value={campuses.length} />
          <HeroStat
            icon={BriefcaseBusiness}
            label={TRACKS.domain.label}
            value={loaded ? mean(members.map((row) => row.domain)) : null}
            suffix="%"
          />
          <HeroStat
            icon={MessagesSquare}
            label={TRACKS.elq.short}
            value={loaded ? mean(members.map((row) => row.elq)) : null}
            suffix="%"
          />
        </dl>
      </Hero>

      <div className="grid items-start gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        <section className="min-w-0 space-y-3 lg:col-span-2">
          <SectionTitle
            icon={Layers}
            title="Cohorts Compared"
            description="Average of each cohort's students; the marker shows all students."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <CohortCard key={group.name} group={group} everyone={everyone} loaded={loaded} />
            ))}
          </div>
        </section>

        <section className={cn(panel, 'p-5')}>
          <SectionTitle
            icon={Building2}
            title="By Campus"
            description="Where the Super 100 study."
          />
          <ul className="mt-4 space-y-3">
            {byCampus.map(({ campus, n }) => (
              <li key={campus}>
                <button
                  type="button"
                  onClick={() =>
                    setSearch({ campus: search.campus === campus ? undefined : campus })
                  }
                  className={cn(
                    'w-full rounded-lg px-2 py-1 text-left transition hover:bg-slate-50',
                    search.campus === campus && 'bg-brand-500/10'
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{campus}</span>
                    <span className="shrink-0 font-bold tabular-nums">{n}</span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="bar-fill block h-full rounded-full bg-gradient-to-r from-[#e9c27a] to-[#c8913a]"
                      style={{ width: `${(n / (byCampus[0]?.n || 1)) * 100}%` }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="space-y-3">
        <SectionTitle
          icon={Crown}
          title="Super 100 Students"
          description={
            [search.campus, search.batch ? batchLabel(search.batch) : search.program]
              .filter(Boolean)
              .join(' · ') || 'Every campus'
          }
          aside={`${rows.length} of ${members.length}`}
        />
        <StudentFilters
          values={search}
          options={options}
          onChange={setSearch}
          superToggle={false}
        />
        <StudentTable
          rows={rows}
          sort={sort}
          onSort={(next) => setSearch({ sort: next === 'domain' ? undefined : next })}
          empty="No Super 100 students match these filters."
        />
      </section>
    </div>
  );
}

function CohortCard({
  group,
  everyone,
  loaded,
}: {
  group: Group;
  everyone: Row[];
  loaded: boolean;
}) {
  const programs = byProgram(group.rows.map((row) => row.student));
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-bold">
            {group.super100 ? (
              <Crown className="size-4 text-[#c8913a]" aria-hidden />
            ) : (
              <Layers className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
            )}
            <span className="truncate">{cohortDisplay(group.name)}</span>
          </p>
          <p className="text-xs text-slate-500">
            {['BBA', 'MBA']
              .filter((program) => programs[program])
              .map((program) => `${program} ${programs[program]}`)
              .join(' · ')}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-2xl font-bold tabular-nums">
          {group.rows.length.toLocaleString('en-IN')}
          <Users className="size-4 text-slate-400" aria-hidden />
        </span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {METRICS.map(({ key, label, icon: Icon, unit }) => {
          const value = loaded ? mean(group.rows.map((row) => row[key])) : null;
          const base = loaded ? mean(everyone.map((row) => row[key])) : null;
          const fill = key === 'attendance' ? attendanceFill(value) : scoreFill(value);
          return (
            <li key={key}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                  <Icon className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                  <span className="truncate">{label}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className={cn('text-sm font-bold', scoreTone(value))}>
                    {value === null ? '—' : `${value}${unit}`}
                  </span>
                  {value !== null && base !== null && value !== base && (
                    <span
                      className={cn(
                        'ml-1.5 text-[11px] font-semibold',
                        value > base ? 'text-emerald-600' : 'text-red-600'
                      )}
                      title={`All students: ${base}${unit}`}
                    >
                      {value > base ? '+' : '−'}
                      {Math.abs(value - base)}
                    </span>
                  )}
                </span>
              </div>
              <div className="relative mt-1 h-1.5 rounded-full bg-slate-100">
                <div
                  className="bar-fill h-full rounded-full"
                  style={{ width: `${value ?? 0}%`, background: fill }}
                />
                {base !== null && (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-slate-500"
                    style={{ left: `${base}%` }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
  const className = cn(
    panel,
    'hover-lift relative block overflow-hidden p-5',
    group.super100 && 'border-[#e9c27a] ring-1 ring-[#e9c27a]/60'
  );
  if (group.name === NO_COHORT) return <div className={className}>{body}</div>;
  return (
    <Link to="/" search={{ cohort: group.name }} className={cn(className, 'group')}>
      {group.super100 && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#e9c27a] to-[#c8913a]"
        />
      )}
      {body}
      <span className="text-brand-700 dark:text-brand-300 mt-3 inline-flex items-center gap-1 text-xs font-semibold">
        Open in Students
        <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
