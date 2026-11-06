import { useMemo } from 'react';
import { Award, CalendarCheck, Crown, GraduationCap, Users } from 'lucide-react';

import { PageLoader } from '@/components/common/PageLoader';
import { useStudents } from '@/hooks/useStudents';
import { useStudentMetrics } from '@/lib/assessments';
import { useSession } from '@/lib/session';

import { StudentFilters } from '../components/StudentFilters';
import { StudentTable } from '../components/StudentTable';
import { Hero, HeroStat, Problem, heroGrid } from '../components/ui';
import { cn } from '@/lib/utils';
import { byProgram, inBatch, mean, sortRows, toRow, unique } from '../lib/rows';
import { batchLabel } from '@/lib/cohorts';
import { cohortDisplay } from '../lib/subjects';
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

      {metrics.isError && (
        <Problem
          message={`${metrics.error.message} Names are listed without their numbers.`}
          onRetry={() => metrics.refetch()}
        />
      )}

      <StudentTable
        rows={rows}
        sort={sort}
        onSort={(next) => setSearch({ sort: next === 'name' ? undefined : next })}
      />
    </div>
  );
}
