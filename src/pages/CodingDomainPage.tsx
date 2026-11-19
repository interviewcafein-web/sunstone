// PRIME Coding Domain (Vertex): AMCAT and the AMCAT mock tests, placement readiness, syllabus
// and class delivery, and student performance with cohort movement between AMCAT cycles, for
// any campus, program and batch. Numbers from api/_coding.ts (GET /api/prime).

import { useMemo, type ReactNode } from 'react';
import {
  Award,
  BookOpenCheck,
  BriefcaseBusiness,
  ClipboardCheck,
  Code2,
  Loader2,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { PageLoader } from '@/components/common/PageLoader';
import AmcatTab from '@/components/coding-domain/AmcatTab';
import DeliveryTab from '@/components/coding-domain/DeliveryTab';
import MovementTab from '@/components/coding-domain/MovementTab';
import ReadinessTab from '@/components/coding-domain/ReadinessTab';
import type { TabProps } from '@/components/coding-domain/types';
import { cohortLabel } from '@/lib/cohorts';
import {
  DEFAULT_PASS,
  cyclesWithData,
  employable,
  filterStudents,
  pct,
  useCodingDomain,
  type CodingSearch,
  type CodingTab,
} from '@/lib/codingDomain';
import { cn } from '@/lib/utils';

const TABS: { id: CodingTab; label: string; icon: LucideIcon }[] = [
  { id: 'amcat', label: 'AMCAT & Assessments', icon: Award },
  { id: 'readiness', label: 'Placement Readiness', icon: BriefcaseBusiness },
  { id: 'delivery', label: 'Syllabus & Class Delivery', icon: BookOpenCheck },
  { id: 'movement', label: 'Student Performance & Cohort Movement', icon: TrendingUp },
];

const select =
  'max-w-56 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white [&>option]:text-slate-900';

export default function CodingDomainPage({
  search,
  setSearch,
  studentLink,
}: {
  search: CodingSearch;
  setSearch: (patch: Partial<CodingSearch>) => void;
  studentLink: (slug: string, children: ReactNode) => ReactNode;
}) {
  const tab = search.tab ?? 'amcat';
  const query = useCodingDomain(search.campus);
  const data = query.data;
  const pass = search.pass ?? DEFAULT_PASS;

  const students = useMemo(
    () => (data ? filterStudents(data.students, search) : []),
    [data, search]
  );
  const cycles = useMemo(
    () => (data ? cyclesWithData(students, data.cycles) : []),
    [data, students]
  );

  if (query.isPending) return <PageLoader label="Loading the PRIME coding numbers" />;
  if (!data) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
      >
        <p className="font-semibold">The PRIME coding numbers did not load.</p>
        <p className="mt-1">{query.error?.message}</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="bg-surface mt-3 rounded-md border border-red-300 px-3 py-1.5 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  const cycle =
    cycles.find((item) => item.key === search.cycle) ?? cycles[cycles.length - 1] ?? null;
  // Options from every student at the chosen campus (not narrowed by the other filters).
  const programs = [...new Set(data.students.map((row) => row.program))].sort();
  const batches = [
    ...new Set(
      data.students
        .filter((row) => !search.program || row.program === search.program)
        .map((row) => row.year)
        .filter((year): year is number => year != null)
    ),
  ].sort((a, b) => b - a);
  const tracks = [
    ...new Set(data.students.map((row) => row.track).filter(Boolean) as string[]),
  ].sort();

  const campusName = search.campus
    ? data.campuses.find((campus) => campus.id === search.campus)?.name
    : null;
  const scope =
    [
      campusName ?? 'All Campuses',
      search.batch && search.program
        ? cohortLabel(search.program, String(search.batch))
        : (search.program ?? (search.batch ? `${search.batch} batch` : null)),
      search.track && (search.track === 'any' ? 'COE' : `COE ${search.track}`),
    ]
      .filter(Boolean)
      .join(' · ') || 'All Campuses';

  // Headline figures.
  const sat = cycle ? students.filter((row) => row.amcat[cycle.key]) : [];
  const judged = cycle
    ? students.map((row) => employable(row.amcat[cycle.key], pass)).filter((v) => v !== null)
    : [];
  const ready = judged.filter(Boolean).length;
  const placed = students.filter((row) => row.placed).length;
  const sections = data.delivery.sections.filter(
    (row) =>
      (!search.program || row.program === search.program) &&
      (!search.batch || row.batch_year === search.batch)
  );
  const plannedHours = sections.reduce((sum, row) => sum + row.planned, 0);
  const verifiedHours = sections.reduce((sum, row) => sum + row.verified_hours, 0);

  const props: TabProps = {
    data,
    students,
    search,
    setSearch,
    pass,
    cycles,
    cycle,
    scope,
    studentLink,
  };

  return (
    <div className="space-y-5">
      <section className="from-brand-700 via-brand-800 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-brand-200 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
              <span aria-hidden className="bg-brand-300 h-px w-6" />
              PRIME Coding Domain
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{scope}</h1>
            <p className="text-brand-100 mt-1 max-w-2xl text-sm">
              AMCAT and mock tests, placement readiness, syllabus and class delivery, and how
              students move between AMCAT cycles, from the LMS and the delivery tracker.
            </p>
          </div>
          {query.isFetching && (
            <Loader2 className="text-brand-200 size-4 animate-spin" aria-label="Updating" />
          )}
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          {data.campuses.length > 1 && (
            <select
              aria-label="Campus"
              value={search.campus ?? ''}
              onChange={(event) =>
                setSearch({
                  campus: event.target.value ? Number(event.target.value) : undefined,
                  section: undefined,
                })
              }
              className={select}
            >
              <option value="">All Campuses</option>
              {data.campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Program"
            value={search.program ?? ''}
            onChange={(event) =>
              setSearch({ program: event.target.value || undefined, batch: undefined })
            }
            className={select}
          >
            <option value="">All Programs</option>
            {programs.map((program) => (
              <option key={program}>{program}</option>
            ))}
          </select>
          <select
            aria-label="Batch"
            value={search.batch ?? ''}
            onChange={(event) =>
              setSearch({ batch: event.target.value ? Number(event.target.value) : undefined })
            }
            className={select}
          >
            <option value="">All Batches</option>
            {batches.map((year) => (
              <option key={year} value={year}>
                {search.program ? cohortLabel(search.program, String(year)) : `${year} batch`}
              </option>
            ))}
          </select>
          {tracks.length > 0 && (
            <select
              aria-label="Centre of Excellence"
              value={search.track ?? ''}
              onChange={(event) => setSearch({ track: event.target.value || undefined })}
              className={select}
            >
              <option value="">Everyone</option>
              <option value="any">COE: Every Track</option>
              {tracks.map((track) => (
                <option key={track} value={track}>
                  COE: {track}
                </option>
              ))}
            </select>
          )}
          {cycles.length > 0 && (
            <select
              aria-label="AMCAT cycle"
              value={cycle?.key ?? ''}
              onChange={(event) =>
                setSearch({
                  cycle:
                    event.target.value === cycles[cycles.length - 1]?.key
                      ? undefined
                      : event.target.value,
                })
              }
              className={select}
            >
              {cycles.map((item) => (
                <option key={item.key} value={item.key}>
                  AMCAT {item.label}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm">
            Pass Mark
            <input
              type="number"
              min={1}
              max={100}
              value={pass}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (value > 0 && value <= 100)
                  setSearch({ pass: value === DEFAULT_PASS ? undefined : value });
              }}
              className="w-12 rounded bg-white/15 px-1 text-right text-white tabular-nums"
              aria-label="AMCAT pass mark"
            />
          </label>
        </div>

        <dl className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Stat icon={Users} label="Students" value={students.length.toLocaleString('en-IN')} />
          <Stat
            icon={ClipboardCheck}
            label={cycle ? `Took AMCAT ${cycle.label}` : 'Took AMCAT'}
            value={cycle ? `${pct(sat.length, students.length) ?? 0}%` : '—'}
            note={cycle ? sat.length.toLocaleString('en-IN') : undefined}
          />
          <Stat
            icon={UserCheck}
            label={`Basic Employable (${pass}+)`}
            value={judged.length ? `${pct(ready, judged.length)}%` : '—'}
            note={judged.length ? `${ready} of ${judged.length}` : undefined}
          />
          <Stat
            icon={BriefcaseBusiness}
            label="Placed or Interning"
            value={placed.toLocaleString('en-IN')}
            note={students.length ? `${pct(placed, students.length)}%` : undefined}
          />
          <Stat
            icon={Code2}
            label="Hours Taught (Verified)"
            value={`${pct(verifiedHours, plannedHours) ?? 0}%`}
            note={`${Math.round(verifiedHours)} of ${plannedHours} h`}
          />
        </dl>
      </section>

      <nav
        aria-label="PRIME Coding views"
        className="scrollbar-none flex gap-1 overflow-x-auto rounded-full bg-slate-100/80 p-1"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setSearch({ tab: id === 'amcat' ? undefined : id })}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition',
              tab === id
                ? 'bg-surface text-brand-700 dark:text-brand-200 shadow-[0_1px_3px_rgb(15_23_42/0.12)] ring-1 ring-slate-200'
                : 'hover:text-brand-700 text-slate-600'
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      <div className="space-y-5" key={tab}>
        {tab === 'amcat' && <AmcatTab {...props} />}
        {tab === 'readiness' && <ReadinessTab {...props} />}
        {tab === 'delivery' && <DeliveryTab {...props} />}
        {tab === 'movement' && <MovementTab {...props} />}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col-reverse rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
      <dt className="text-brand-100 mt-0.5 flex items-center gap-1.5 text-xs">
        <Icon className="text-brand-200 size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="text-xl font-bold whitespace-nowrap tabular-nums sm:text-2xl">
        {value}
        {note && <span className="text-brand-200 ml-1.5 text-sm font-medium">{note}</span>}
      </dd>
    </div>
  );
}
