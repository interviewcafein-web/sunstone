import { useMemo, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';

import { StudentFilters } from '@/components/students/StudentFilters';
import { StudentsHero } from '@/components/students/StudentsHero';
import { StudentsTable, type Cell, type StudentRow } from '@/components/students/StudentsTable';
import { TopPerformers } from '@/components/students/TopPerformers';
import { ZonePanel } from '@/components/students/ZonePanel';
import {
  SUMMARY_QUERY_KEY,
  summaryKey,
  useStudentSummaries,
  type SummaryQuery,
} from '@/hooks/useStudentSummaries';
import { useStudents } from '@/hooks/useStudents';
import { PLATFORM_IDS, SOLVING_PLATFORM_IDS } from '@/lib/coding-profiles/platforms';
import { ProfileError, type PlatformId } from '@/lib/coding-profiles/types';
import { useTour } from '@/hooks/useTour';
import { fetchReportExtras, useStudentMetrics, type StudentMetrics } from '@/lib/assessments';
import { buildInsights, type StudentInsight } from '@/lib/insights';
import { useSession } from '@/lib/session';
import type { Student } from '@/lib/students/types';
import { ZONE_BASIS, zoneOf, type ZoneResult } from '@/lib/students/zones';
import type { CampusReportRow, ReportValue } from '@/reports';
import type { SortKey, StudentsSearch } from '@/routes/index';
import { PageLoader } from '@/components/common/PageLoader';

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

function toRow(
  student: Student,
  queries: Map<string, SummaryQuery>,
  metrics?: StudentMetrics
): StudentRow {
  const cells = Object.fromEntries(
    PLATFORM_IDS.map((platform) => [platform, toCell(student, platform, queries)])
  ) as Record<PlatformId, Cell>;

  let total = 0;
  let strongest: StudentRow['strongest'];
  for (const platform of SOLVING_PLATFORM_IDS) {
    const cell = cells[platform];
    if (cell.kind !== 'ok') continue;
    total += cell.summary.value;
    if (cell.summary.value > (strongest?.share ?? 0)) {
      strongest = { platform, share: cell.summary.value };
    }
  }
  // `share` held the raw count while searching; turn it into a percentage of the total.
  if (strongest) strongest = { ...strongest, share: Math.round((strongest.share / total) * 100) };

  let lastActive: StudentRow['lastActive'];
  for (const platform of PLATFORM_IDS) {
    const cell = cells[platform];
    const day = cell.kind === 'ok' ? cell.summary.lastActive : undefined;
    if (day && (!lastActive || day > lastActive.day)) lastActive = { day, platform };
  }

  return {
    student,
    cells,
    total,
    strongest,
    lastActive,
    zone: rowZone(cells),
    metrics,
    loading: PLATFORM_IDS.some((platform) => cells[platform].kind === 'loading'),
  };
}

/**
 * The zone comes from the first platform in ZONE_BASIS that loaded. If a platform ahead of
 * it is still loading, the zone is not known yet (null) rather than decided by a fallback.
 */
function rowZone(cells: Record<PlatformId, Cell>): ZoneResult | null {
  const solved: Partial<Record<PlatformId, number>> = {};
  for (const platform of ZONE_BASIS) {
    const cell = cells[platform];
    if (cell.kind === 'loading') return null;
    if (cell.kind === 'ok') solved[platform] = cell.summary.value;
  }
  return zoneOf(solved);
}

function toReportRow(row: StudentRow, insight: StudentInsight): CampusReportRow {
  const values = Object.fromEntries(
    PLATFORM_IDS.map((platform): [PlatformId, ReportValue] => {
      const cell = row.cells[platform];
      if (cell.kind === 'ok') return [platform, cell.summary.value];
      if (cell.kind === 'none' || cell.kind === 'invalid' || cell.kind === 'not_found') {
        return [platform, cell.kind];
      }
      return [platform, cell.kind === 'loading' ? 'loading' : 'error'];
    })
  ) as Record<PlatformId, ReportValue>;
  return {
    name: row.student.name,
    campus: row.student.campus,
    course: row.student.course,
    batch: row.student.batch,
    values,
    total: row.total,
    // Still loading somewhere: placed by the platforms that have answered so far.
    zone:
      row.zone ??
      zoneOf(
        Object.fromEntries(
          ZONE_BASIS.flatMap((platform) => {
            const cell = row.cells[platform];
            return cell.kind === 'ok' ? [[platform, cell.summary.value]] : [];
          })
        )
      ),
    lastActive: row.lastActive?.day,
    insight,
    metrics: row.metrics,
  };
}

function compareRows(sort: SortKey) {
  const byName = (a: StudentRow, b: StudentRow) => a.student.name.localeCompare(b.student.name);
  if (sort === 'name') return byName;

  if (sort === 'active') {
    // Most recently active first; students with no activity date go last.
    return (a: StudentRow, b: StudentRow) =>
      (b.lastActive?.day ?? '').localeCompare(a.lastActive?.day ?? '') || byName(a, b);
  }

  const score = (row: StudentRow) => {
    if (sort === 'total') return row.total;
    if (sort === 'attendance') return row.metrics?.attendance ?? -1;
    if (sort === 'tests') return row.metrics?.test_avg ?? -1;
    if (sort === 'amcat') return row.metrics?.amcat?.at(-1)?.[1] ?? -1;
    const cell = row.cells[sort];
    return cell.kind === 'ok' ? cell.summary.value : -1;
  };
  return (a: StudentRow, b: StudentRow) => score(b) - score(a) || byName(a, b);
}

export default function StudentsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();
  // Campus staff only ever get their own campuses from the API; name them in the header.
  const ownCampuses = useSession().data?.campuses;
  const sort = search.sort ?? 'total';

  const students = useStudents();
  // Attendance, AMCAT and PRIME tests for the table (from the LMS copy in the database).
  const metrics = useStudentMetrics();
  // First visit: a guided tour, once the list is on screen.
  useTour('students', Boolean(students.data?.students.length));
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
  const rows = filtered
    .map((student) => toRow(student, summaries.byKey, metrics.data?.students[student.slug]))
    .sort(compareRows(sort));

  const shown = search.zone ? rows.filter((row) => row.zone?.zone === search.zone) : rows;
  const [reportState, setReportState] = useState<'idle' | 'busy' | 'failed'>('idle');

  // The report covers every student in the chosen campus (or every campus) and batch/course
  // filters, so it waits until every profile has loaded and ignores the name search and zone
  // filter. Without a campus it covers all campuses, one after another. It also waits for
  // attendance, tests and AMCAT, but goes ahead without them if they could not be loaded.
  const reportBlocker = search.q
    ? 'Clear the name search so the report includes every student.'
    : metrics.isPending
      ? 'Loading attendance, tests and AMCAT.'
      : undefined;
  // Coding numbers never hold the report up: saved ones show at once, and the few profiles
  // still loading from the platforms are marked in the report.
  const stillLoading = summaries.total - summaries.settled;
  const reportNote = stillLoading
    ? `${stillLoading.toLocaleString()} coding profiles still loading; they show as … in the report.`
    : undefined;

  const downloadReport = async () => {
    setReportState('busy');
    try {
      const { downloadCampusReport } = await import('@/reports');
      // The 360° view of each student, from the coding numbers and LMS metrics already loaded.
      const insights = new Map(
        buildInsights(
          filtered,
          metrics.data?.students,
          (platform, handle) => summaries.byKey.get(summaryKey(platform, handle))?.data
        ).map((insight) => [insight.student, insight])
      );
      // From each campus page: tests with unusual scores, PRIME coding delivery and instructors.
      // The report goes ahead without them if they cannot be loaded.
      const cohort =
        search.course && search.batch
          ? `${search.course}:${search.batch}`
          : search.course
            ? `${search.course}:`
            : search.batch || undefined;
      const { flaggedTests, delivery } = await fetchReportExtras(
        [...new Set(rows.map((row) => row.student.campus))],
        cohort
      ).catch(() => ({ flaggedTests: [], delivery: [] }));
      await downloadCampusReport({
        origin: window.location.origin,
        title: search.campus ?? 'All campuses',
        filters: [search.batch && `Batch ${search.batch}`, search.course].filter(
          (value): value is string => Boolean(value)
        ),
        generatedAt: new Date(),
        rows: rows.map((row) => toReportRow(row, insights.get(row.student)!)),
        allCampuses: !search.campus,
        flaggedTests,
        delivery,
      });
      setReportState('idle');
    } catch (error) {
      console.error(error);
      setReportState('failed');
    }
  };

  const setSearch = (patch: Partial<StudentsSearch>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const refresh = () => {
    students.refetch();
    queryClient.invalidateQueries({ queryKey: [SUMMARY_QUERY_KEY] });
  };

  if (students.isPending) {
    return <PageLoader label="Loading the student list" />;
  }

  if (students.isError && all.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-semibold">The student list could not be loaded.</p>
        <p className="mt-1">{students.error.message}</p>
        <button
          type="button"
          onClick={() => students.refetch()}
          className="mt-3 rounded-md border border-red-300 bg-surface px-3 py-1.5 font-medium hover:bg-red-50"
        >
          Try again
        </button>
      </div>
    );
  }

  const solved = rows.reduce((sum, row) => sum + row.total, 0);
  // Students with coding activity on any platform in the last 7 days.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const activeThisWeek = rows.filter(
    (row) => row.lastActive && row.lastActive.day >= weekAgo
  ).length;
  const scope =
    [search.campus, search.batch && `Batch ${search.batch}`, search.course]
      .filter(Boolean)
      .join(' · ') ||
    (ownCampuses
      ? ownCampuses.map((campus) => campus.name).join(', ') || 'No campus assigned'
      : 'All campuses');

  return (
    <div className="rise-stagger space-y-5">
      <StudentsHero
        scope={scope}
        students={rows.length}
        totalStudents={all.length}
        solved={solved}
        linked={summaries.total}
        activeThisWeek={activeThisWeek}
        checkedAt={students.dataUpdatedAt}
        settled={summaries.settled}
        refreshing={summaries.refreshing}
        onRefresh={refresh}
      />

      <div data-tour="filters">
        <StudentFilters search={search} options={options} onChange={setSearch} />
      </div>

      <div data-tour="zones">
        <ZonePanel
          rows={rows}
          active={search.zone}
          onZone={(zone) => setSearch({ zone })}
          report={{
            blocker: reportBlocker,
            note: reportNote,
            state: reportState,
            label: search.campus ? 'Download campus report' : 'Download all-campus report',
            onDownload: downloadReport,
          }}
        />
      </div>

      {!search.q && <TopPerformers rows={shown} />}

      {shown.length > 0 ? (
        <div data-tour="table">
          <StudentsTable rows={shown} sort={sort} onSort={(next) => setSearch({ sort: next })} />
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-600">
          No students match these filters.
        </p>
      )}
    </div>
  );
}
