import { useMemo } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { StudentFilters } from '@/components/students/StudentFilters';
import { StudentsHero } from '@/components/students/StudentsHero';
import { StudentsTable, type Cell, type StudentRow } from '@/components/students/StudentsTable';
import { TopPerformers } from '@/components/students/TopPerformers';
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
  const scope =
    [search.campus, search.batch && `Batch ${search.batch}`, search.course]
      .filter(Boolean)
      .join(' · ') || 'All campuses';

  return (
    <div className="rise-stagger space-y-5">
      <StudentsHero
        scope={scope}
        students={rows.length}
        totalStudents={all.length}
        solved={solved}
        linked={summaries.total}
        toFix={toFix}
        checkedAt={students.dataUpdatedAt}
        settled={summaries.settled}
        onRefresh={refresh}
      />

      <StudentFilters search={search} options={options} onChange={setSearch} />

      {!search.q && <TopPerformers rows={rows} />}

      {rows.length > 0 ? (
        <StudentsTable rows={rows} sort={sort} onSort={(next) => setSearch({ sort: next })} />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-600">
          No students match these filters.
        </p>
      )}
    </div>
  );
}
