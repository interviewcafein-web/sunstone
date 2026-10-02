import { useMemo } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';

import { StatTiles } from '@/components/profile/StatTiles';
import { StudentFilters } from '@/components/students/StudentFilters';
import { StudentsTable, type Cell, type StudentRow } from '@/components/students/StudentsTable';
import {
  SUMMARY_QUERY_KEY,
  summaryKey,
  useStudentSummaries,
  type SummaryQuery,
} from '@/hooks/useStudentSummaries';
import { useStudents } from '@/hooks/useStudents';
import { PLATFORM_IDS, SOLVING_PLATFORM_IDS } from '@/lib/coding-profiles/platforms';
import { ProfileError, type PlatformId } from '@/lib/coding-profiles/types';
import type { Student } from '@/lib/students/types';
import type { SortKey, StudentsSearch } from '@/routes/index';

const route = getRouteApi('/');

const unique = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

function toCell(student: Student, platform: PlatformId, queries: Map<string, SummaryQuery>): Cell {
  if (student.invalid.includes(platform)) return { kind: 'invalid' };
  const handle = student.handles[platform];
  const query = handle && queries.get(summaryKey(platform, handle));
  if (!handle || !query) return { kind: 'none' };

  if (query.data) return { kind: 'ok', handle, summary: query.data };
  if (query.isPending) return { kind: 'loading', handle };
  if (query.error instanceof ProfileError && query.error.kind === 'not_found') {
    return { kind: 'not_found', handle };
  }
  return {
    kind: 'error',
    handle,
    message: query.error?.message ?? 'Could not load.',
    retry: () => query.refetch(),
  };
}

function toRow(student: Student, queries: Map<string, SummaryQuery>): StudentRow {
  const cells = Object.fromEntries(
    PLATFORM_IDS.map((platform) => [platform, toCell(student, platform, queries)])
  ) as Record<PlatformId, Cell>;

  let total = 0;
  for (const platform of SOLVING_PLATFORM_IDS) {
    const cell = cells[platform];
    if (cell.kind === 'ok') total += cell.summary.value;
  }
  return {
    student,
    cells,
    total,
    loading: PLATFORM_IDS.some((platform) => cells[platform].kind === 'loading'),
  };
}

function compareRows(sort: SortKey) {
  const byName = (a: StudentRow, b: StudentRow) => a.student.name.localeCompare(b.student.name);
  if (sort === 'name') return byName;

  const score = (row: StudentRow) => {
    if (sort === 'total') return row.total;
    const cell = row.cells[sort];
    return cell.kind === 'ok' ? cell.summary.value : -1;
  };
  return (a: StudentRow, b: StudentRow) => score(b) - score(a) || byName(a, b);
}

export default function StudentsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();
  const sort = search.sort ?? 'total';

  const students = useStudents();
  const all = useMemo(() => students.data?.students ?? [], [students.data]);

  const options = useMemo(
    () => ({
      campus: unique(all.map((student) => student.campus)),
      course: unique(all.map((student) => student.course)),
      batch: unique(all.map((student) => student.batch)),
    }),
    [all]
  );

  const filtered = useMemo(() => {
    const needle = search.q?.toLowerCase();
    return all.filter(
      (student) =>
        (!search.campus || student.campus === search.campus) &&
        (!search.course || student.course === search.course) &&
        (!search.batch || student.batch === search.batch) &&
        (!needle || student.name.toLowerCase().includes(needle))
    );
  }, [all, search.campus, search.course, search.batch, search.q]);

  // Only the students on screen are fetched, so a campus or batch view loads faster.
  const summaries = useStudentSummaries(filtered);
  const rows = filtered.map((student) => toRow(student, summaries.byKey)).sort(compareRows(sort));

  const setSearch = (patch: Partial<StudentsSearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const refresh = () => {
    students.refetch();
    queryClient.invalidateQueries({ queryKey: [SUMMARY_QUERY_KEY] });
  };

  if (students.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading the student list…
      </p>
    );
  }

  if (students.isError && all.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-semibold">The student list could not be loaded.</p>
        <p className="mt-1">{students.error.message}</p>
        <button
          type="button"
          onClick={() => students.refetch()}
          className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium hover:bg-red-50"
        >
          Try again
        </button>
      </div>
    );
  }

  const solved = rows.reduce((sum, row) => sum + row.total, 0);
  const toFix = rows.reduce(
    (count, row) =>
      count +
      PLATFORM_IDS.filter((id) => ['invalid', 'not_found'].includes(row.cells[id].kind)).length,
    0
  );
  const loadingProfiles = summaries.settled < summaries.total;

  return (
    <div className="rise-stagger space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-slate-600">
            Showing {rows.length} of {all.length} students. Sheet last checked at{' '}
            {new Date(students.dataUpdatedAt).toLocaleTimeString()}; new responses appear within a
            minute.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="bg-brand-700 hover:bg-brand-800 focus-visible:outline-brand-500 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <RefreshCw className="size-4" aria-hidden />
          Refresh stats
        </button>
      </div>

      <StudentFilters search={search} options={options} onChange={setSearch} />

      <section className="shadow-card rounded-xl border border-slate-200 bg-white p-4">
        <StatTiles
          stats={[
            { label: 'Students', value: rows.length },
            { label: 'Problems solved', value: solved },
            {
              label: 'Average per student',
              value: rows.length ? Math.round(solved / rows.length) : 0,
            },
            { label: 'Profiles linked', value: summaries.total },
            { label: 'Entries to fix', value: toFix },
          ]}
        />
        {loadingProfiles && (
          <div className="mt-3" role="status">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="bg-brand-500 h-full rounded-full transition-[width]"
                style={{ width: `${(summaries.settled / summaries.total) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Loaded {summaries.settled} of {summaries.total} profiles. Totals and ranking update as
              they arrive.
            </p>
          </div>
        )}
      </section>

      {rows.length > 0 ? (
        <StudentsTable rows={rows} sort={sort} onSort={(next) => setSearch({ sort: next })} />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          No students match these filters.
        </p>
      )}
    </div>
  );
}
