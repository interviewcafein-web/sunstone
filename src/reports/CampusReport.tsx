import { Document, Image, Page, Text, View } from '@react-pdf/renderer';

import { lmsDate, type StudentMetrics } from '@/lib/assessments';
import { cohortLabel } from '@/lib/cohorts';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import type { PlatformId } from '@/lib/coding-profiles/types';
import { BAND_COLORS, bandOf, dimensionById, type StudentInsight } from '@/lib/insights';
import { ZONE_BASIS, ZONES, zoneById, type ZoneResult } from '@/lib/students/zones';
import { HealthComparisonPage, InsightsPage } from '@/reports/Insights';
import { UnusualScoresPage, type ReportFlaggedTest } from '@/reports/UnusualScores';
import {
  INK,
  LINE,
  MUTED,
  NAVY,
  ReportFooter,
  ReportHeader,
  SOFT,
  StatTile,
  base,
  formatDate,
  formatNumber,
} from '@/reports/shared';

/** What a platform cell shows: a count, or why there is none. */
/** A solved count, or why there is none. "loading": the platform had not answered yet. */
export type ReportValue = number | 'none' | 'invalid' | 'not_found' | 'error' | 'loading';

export interface CampusReportRow {
  name: string;
  campus: string;
  course: string;
  batch: string;
  values: Record<PlatformId, ReportValue>;
  total: number;
  zone: ZoneResult;
  /** YYYY-MM-DD. */
  lastActive?: string;
  /** The student on the five fronts of the 360° view. */
  insight: StudentInsight;
  /** Attendance, PRIME tests, AMCAT and exams from the LMS, when there are any. */
  metrics?: StudentMetrics;
}

export interface CampusReportData {
  origin: string;
  /** Campus name, or "All campuses". */
  title: string;
  /** Other filters in force, e.g. ["Batch 2027", "B.Tech"]. */
  filters: string[];
  generatedAt: Date;
  rows: CampusReportRow[];
  /** One report covering every campus: a comparison page, then each campus in turn. */
  allCampuses?: boolean;
  /** Tests with unusually high, uniform scores (possible copying), for the report's campuses. */
  flaggedTests?: ReportFlaggedTest[];
}

const SHORT: Record<PlatformId, string> = {
  leetcode: 'LeetCode',
  geeksforgeeks: 'GFG',
  hackerrank: 'HackerRank',
  codeforces: 'Codeforces',
  codechef: 'CodeChef',
  github: 'GitHub',
};

const platformName = (id: PlatformId) => PLATFORMS.find((platform) => platform.id === id)!.name;

/** Platform logo for the PDF (PNG; react-pdf cannot draw SVG). */
function PlatformMark({ origin, id, size = 8 }: { origin: string; id: PlatformId; size?: number }) {
  return (
    <Image
      src={`${origin}/reports/platforms/${id}.png`}
      style={{ width: size, height: size, marginRight: 2.5, objectFit: 'contain' }}
    />
  );
}

const DAY_MS = 86_400_000;
function daysSince(day?: string) {
  if (!day) return undefined;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((today - Date.parse(day)) / DAY_MS));
}
function lastActiveLabel(day?: string) {
  const days = daysSince(day);
  if (days === undefined) return '—';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function cellText(value: ReportValue) {
  if (typeof value === 'number') return formatNumber(value);
  if (value === 'invalid') return 'check';
  if (value === 'not_found') return 'not found';
  if (value === 'error') return 'n/a';
  if (value === 'loading') return '…';
  return '—';
}

// Column widths for the zone tables, in points (A4 landscape leaves ~778pt inside margins).
const COLUMNS = {
  index: 20,
  student: 128,
  basis: 78,
  platform: 46,
  total: 44,
  active: 50,
  /** Attendance, PRIME tests, AMCAT and exams. */
  front: 44,
  exams: 36,
};

const ATTENDANCE = dimensionById('attendance');
const TESTS = dimensionById('tests');
const AMCAT = dimensionById('amcat');
const EXAMS = dimensionById('exams');

/** "2026-08-21" → "Aug 2026". */
const monthOf = (day: string) => lmsDate(day).replace(/^\d+ /, '');

export function CampusReport({ data }: { data: CampusReportData }) {
  const label = [data.title, ...data.filters].join(' · ');
  const document = (children: React.ReactNode) => (
    <Document
      title={`Sunstone PRIME Vertex – Progress Report – ${label}`}
      author="Sunstone PRIME"
      subject="Coding practice, attendance, PRIME Mock Tests, AMCAT and internal exams"
    >
      {children}
    </Document>
  );

  const flagged = data.flaggedTests ?? [];
  if (!data.allCampuses) {
    return document(
      <>
        <CampusPages data={data} kind="Campus Progress Report" withHeader />
        <UnusualScoresPage tests={flagged} label={label} showCampus={false} />
      </>
    );
  }

  // All campuses: overall summary and 360°, the two campus comparisons, then every campus's
  // own pages.
  const campuses = [...new Set(data.rows.map((row) => row.campus))].sort(
    (a, b) =>
      data.rows.filter((row) => row.campus === b).length -
        data.rows.filter((row) => row.campus === a).length || a.localeCompare(b)
  );
  return document(
    <>
      <CampusPages data={data} kind="All-Campus Progress Report" withHeader summaryOnly />
      <ComparisonPage data={data} campuses={campuses} label={label} />
      <HealthComparisonPage insights={data.rows.map((row) => row.insight)} label={label} />
      <UnusualScoresPage tests={flagged} label={label} showCampus />
      {campuses.map((campus) => (
        <CampusPages
          key={campus}
          data={{ ...data, title: campus, rows: data.rows.filter((row) => row.campus === campus) }}
          kind="Campus Progress Report"
        />
      ))}
    </>
  );
}

/**
 * A campus's summary page, its 360° page and its zone tables. `withHeader` draws the navy branded band
 * (the first page of the file); later campuses start with a compact title instead.
 */
function CampusPages({
  data,
  kind,
  withHeader = false,
  summaryOnly = false,
}: {
  data: CampusReportData;
  kind: string;
  withHeader?: boolean;
  summaryOnly?: boolean;
}) {
  const { rows } = data;
  const solved = rows.reduce((sum, row) => sum + row.total, 0);
  const linked = rows.filter((row) => row.zone.zone !== 'none');
  const activeWeek = rows.filter((row) => (daysSince(row.lastActive) ?? 999) <= 7).length;
  const byZone = ZONES.map((zone) => ({
    zone,
    rows: rows
      .filter((row) => row.zone.zone === zone.id)
      .sort((a, b) => (b.zone.count ?? 0) - (a.zone.count ?? 0) || b.total - a.total),
  }));
  const top = [...rows].sort((a, b) => b.total - a.total).slice(0, 5);
  const pending = rows.filter((row) => Object.values(row.values).includes('loading')).length;
  const label = [data.title, ...data.filters].join(' · ');

  return (
    <>
      {/* ── Summary page ── */}
      <Page size="A4" orientation="landscape" style={base.page}>
        {withHeader ? (
          <ReportHeader origin={data.origin} kind={kind} generatedAt={data.generatedAt} />
        ) : (
          <CampusBand origin={data.origin} kind={kind} />
        )}
        <View style={{ paddingHorizontal: 32, paddingTop: 18 }}>
          <Text style={{ fontSize: 22, fontWeight: 800 }}>{data.title}</Text>
          <Text style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
            {[
              ...data.filters,
              `${formatNumber(rows.length)} students`,
              formatDate(data.generatedAt),
              ...(pending
                ? [`${formatNumber(pending)} coding profiles were still loading (shown as …)`]
                : []),
            ].join('  ·  ')}
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <StatTile width="19%" label="Students" value={formatNumber(rows.length)} />
            <StatTile width="19%" label="Problems solved" value={formatNumber(solved)} />
            <StatTile
              width="19%"
              label="Average per student"
              value={formatNumber(rows.length ? Math.round(solved / rows.length) : 0)}
            />
            <StatTile
              width="19%"
              label="Active in last 7 days"
              value={formatNumber(activeWeek)}
              hint={
                rows.length
                  ? `${Math.round((activeWeek / rows.length) * 100)}% of students`
                  : undefined
              }
            />
            <StatTile
              width="19%"
              label="With a usable profile"
              value={formatNumber(linked.length)}
              hint={`${rows.length - linked.length} not linked`}
            />
          </View>

          {/* Zone summary */}
          <Text style={[base.sectionTitle, { marginTop: 20 }]}>Students by zone</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {byZone.map(({ zone, rows: zoneRows }) => (
              <View
                key={zone.id}
                style={{
                  width: '19%',
                  backgroundColor: zone.tint,
                  borderRadius: 8,
                  borderLeftWidth: 4,
                  borderLeftColor: zone.color,
                  padding: 10,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: 700, color: zone.color }}>
                  {zone.label}
                </Text>
                <Text style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
                  {formatNumber(zoneRows.length)}
                </Text>
                <Text style={{ fontSize: 7.5, color: MUTED }}>
                  {rows.length ? Math.round((zoneRows.length / rows.length) * 100) : 0}% ·{' '}
                  {zone.rule}
                </Text>
              </View>
            ))}
          </View>
          {/* Stacked distribution bar */}
          <View
            style={{
              flexDirection: 'row',
              height: 8,
              borderRadius: 4,
              overflow: 'hidden',
              marginTop: 10,
            }}
          >
            {byZone
              .filter(({ rows: zoneRows }) => zoneRows.length)
              .map(({ zone, rows: zoneRows }) => (
                <View
                  key={zone.id}
                  style={{ flexGrow: zoneRows.length, backgroundColor: zone.color }}
                />
              ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 18, marginTop: 20 }}>
            {/* How zones are decided */}
            <View style={{ width: '48%', backgroundColor: SOFT, borderRadius: 8, padding: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>
                How zones are decided
              </Text>
              <Text style={{ fontSize: 8.5, lineHeight: 1.5, color: '#334155' }}>
                Each student is placed by one count: their best number of problems solved on any
                single one of {ZONE_BASIS.map(platformName).join(', ')}. Counts are not added across
                platforms, so easy problems cannot inflate a zone. HackerRank is not used (mostly
                basic problems) and nor is GitHub (contributions, not problems). Students with none
                of these linked are listed under Not linked.
              </Text>
              <View style={{ marginTop: 8, gap: 3 }}>
                {ZONES.map((zone) => (
                  <View key={zone.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: zone.color,
                        marginRight: 6,
                      }}
                    />
                    <Text style={{ fontSize: 8, width: 70, fontWeight: 600 }}>{zone.label}</Text>
                    <Text style={{ fontSize: 8, color: MUTED }}>{zone.advice}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Top performers */}
            <View style={{ width: '48%' }}>
              <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Top performers</Text>
              {top.map((row, index) => (
                <View
                  key={`${row.name}-${index}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 5,
                    borderBottomWidth: 0.75,
                    borderBottomColor: LINE,
                    borderBottomStyle: 'dotted',
                  }}
                >
                  <Text
                    style={{
                      width: 16,
                      fontWeight: 700,
                      color: ['#d97706', '#64748b', '#c2410c'][index] ?? MUTED,
                    }}
                  >
                    {index + 1}
                  </Text>
                  <View style={{ flexGrow: 1 }}>
                    <Text style={{ fontWeight: 600 }}>{row.name}</Text>
                    <Text style={{ fontSize: 7.5, color: MUTED }}>
                      {[summaryOnly && row.campus, cohortLabel(row.course, row.batch)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: 700, fontSize: 11 }}>{formatNumber(row.total)}</Text>
                  <Text style={{ fontSize: 7.5, color: MUTED, marginLeft: 3 }}>solved</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <ReportFooter label={label} />
      </Page>

      {/* ── 360°: the five fronts, pain points, who needs attention ── */}
      <InsightsPage
        title={data.title}
        insights={rows.map((row) => row.insight)}
        groupKey={(row) => (summaryOnly ? row.student.campus : row.student.batch)}
        groupNoun={summaryOnly ? 'campuses' : 'batches'}
        showCampus={summaryOnly}
        label={label}
      />

      {/* ── One section per zone ── */}
      {!summaryOnly && (
        <Page
          size="A4"
          orientation="landscape"
          style={[base.page, { paddingTop: 28, paddingHorizontal: 32 }]}
          wrap
        >
          {byZone.map(({ zone, rows: zoneRows }) => (
            <View key={zone.id} style={{ marginBottom: 18 }}>
              {/* Heading and column titles stay together, with at least a row after them. */}
              <View wrap={false} minPresenceAhead={36}>
                <View
                  style={{
                    backgroundColor: zone.tint,
                    borderLeftWidth: 5,
                    borderLeftColor: zone.color,
                    borderRadius: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: 800, color: zone.color }}>
                      {zone.label} · {zoneRows.length}{' '}
                      {zoneRows.length === 1 ? 'student' : 'students'}
                    </Text>
                    <Text style={{ fontSize: 8.5, color: '#334155', marginTop: 2 }}>
                      {zone.advice}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 8.5, fontWeight: 600, color: MUTED }}>{zone.rule}</Text>
                </View>
                {zoneRows.length === 0 ? (
                  <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 6, marginLeft: 4 }}>
                    No students in this zone.
                  </Text>
                ) : (
                  <TableHeader origin={data.origin} />
                )}
              </View>

              {zoneRows.length > 0 && (
                <>
                  {zoneRows.map((row, index) => (
                    <TableRow
                      key={`${row.name}-${index}`}
                      row={row}
                      index={index}
                      origin={data.origin}
                    />
                  ))}
                </>
              )}
            </View>
          ))}
          <ReportFooter label={label} />
        </Page>
      )}
    </>
  );
}

/** Slim navy strip that opens each campus inside the all-campus report. */
function CampusBand({ origin, kind }: { origin: string; kind: string }) {
  return (
    <View
      style={{
        backgroundColor: NAVY,
        paddingVertical: 9,
        paddingHorizontal: 32,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Image src={`${origin}/sunstone-logo-white.png`} style={{ width: 100, height: 13 }} />
      <Text style={{ color: 'white', fontSize: 9, fontWeight: 600 }}>{kind}</Text>
    </View>
  );
}

/** One row per campus: size, zone counts and mix, average solved and recent activity. */
function ComparisonPage({
  data,
  campuses,
  label,
}: {
  data: CampusReportData;
  campuses: string[];
  label: string;
}) {
  const widths = { campus: 210, students: 50, zone: 54, mix: 120, average: 52, active: 56 };
  const head = { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.4 } as const;

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={[base.page, { paddingTop: 28, paddingHorizontal: 32 }]}
      wrap
    >
      <Text style={{ fontSize: 16, fontWeight: 800 }}>Campus comparison</Text>
      <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3, marginBottom: 10 }}>
        Every campus at a glance. Each campus has its own summary and zone lists after this page,
        largest campus first.
      </Text>

      <View
        fixed
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 6,
          paddingHorizontal: 4,
          borderBottomWidth: 1,
          borderBottomColor: INK,
        }}
      >
        <Text style={[head, { width: widths.campus }]}>CAMPUS</Text>
        <Text style={[head, { width: widths.students, textAlign: 'right' }]}>STUDENTS</Text>
        {ZONES.map((zone) => (
          <Text
            key={zone.id}
            style={[head, { width: widths.zone, textAlign: 'right', color: zone.color }]}
          >
            {zone.id === 'none' ? 'NOT LINKED' : zone.label.replace(' zone', '').toUpperCase()}
          </Text>
        ))}
        <Text style={[head, { width: widths.mix, paddingLeft: 14 }]}>ZONE MIX</Text>
        <Text style={[head, { width: widths.average, textAlign: 'right' }]}>AVG SOLVED</Text>
        <Text style={[head, { width: widths.active, textAlign: 'right' }]}>ACTIVE 7D</Text>
      </View>

      {campuses.map((campus, index) => {
        const rows = data.rows.filter((row) => row.campus === campus);
        const counts = ZONES.map((zone) => rows.filter((row) => row.zone.zone === zone.id).length);
        const solved = rows.reduce((sum, row) => sum + row.total, 0);
        const active = rows.filter((row) => (daysSince(row.lastActive) ?? 999) <= 7).length;
        return (
          <View
            key={campus}
            wrap={false}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 6,
              paddingHorizontal: 4,
              borderBottomWidth: 0.75,
              borderBottomColor: '#cbd5e1',
              borderBottomStyle: 'dotted',
              backgroundColor: index % 2 ? '#fbfcfe' : 'white',
            }}
          >
            <Text style={{ width: widths.campus, fontWeight: 600, paddingRight: 8 }}>{campus}</Text>
            <Text style={{ width: widths.students, textAlign: 'right', fontWeight: 700 }}>
              {formatNumber(rows.length)}
            </Text>
            {counts.map((count, zoneIndex) => (
              <Text
                key={ZONES[zoneIndex].id}
                style={{ width: widths.zone, textAlign: 'right', color: count ? INK : '#cbd5e1' }}
              >
                {formatNumber(count)}
              </Text>
            ))}
            <View style={{ width: widths.mix, paddingLeft: 14 }}>
              <View
                style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' }}
              >
                {counts.map((count, zoneIndex) =>
                  count ? (
                    <View
                      key={ZONES[zoneIndex].id}
                      style={{ flexGrow: count, backgroundColor: ZONES[zoneIndex].color }}
                    />
                  ) : null
                )}
              </View>
            </View>
            <Text style={{ width: widths.average, textAlign: 'right' }}>
              {formatNumber(rows.length ? Math.round(solved / rows.length) : 0)}
            </Text>
            <Text style={{ width: widths.active, textAlign: 'right', color: MUTED }}>
              {rows.length ? `${Math.round((active / rows.length) * 100)}%` : '—'}
            </Text>
          </View>
        );
      })}
      <ReportFooter label={label} />
    </Page>
  );
}

const headerCell = { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.4 } as const;

function TableHeader({ origin }: { origin: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 6,
        paddingHorizontal: 4,
        marginTop: 6,
        borderBottomWidth: 1,
        borderBottomColor: INK,
      }}
    >
      <Text style={[headerCell, { width: COLUMNS.index }]}>#</Text>
      <Text style={[headerCell, { width: COLUMNS.student }]}>STUDENT</Text>
      <Text style={[headerCell, { width: COLUMNS.basis }]}>ZONE BASED ON</Text>
      {PLATFORMS.map((platform) => (
        <View key={platform.id} style={{ width: COLUMNS.platform, alignItems: 'flex-end' }}>
          <PlatformMark origin={origin} id={platform.id} />
          <Text style={[headerCell, { fontSize: 6.5, letterSpacing: 0, marginTop: 1.5 }]}>
            {SHORT[platform.id]}
          </Text>
        </View>
      ))}
      <Text style={[headerCell, { width: COLUMNS.total, textAlign: 'right' }]}>TOTAL</Text>
      <Text style={[headerCell, { width: COLUMNS.active, textAlign: 'right' }]}>
        LAST{'\n'}ACTIVE
      </Text>
      {/* From the LMS: coloured by the 360° bands. */}
      <View
        style={{
          flexDirection: 'row',
          marginLeft: 5,
          borderLeftWidth: 0.75,
          borderLeftColor: LINE,
        }}
      >
        <Text style={[headerCell, { width: COLUMNS.front, textAlign: 'right' }]}>ATTEND.</Text>
        <Text style={[headerCell, { width: COLUMNS.front, textAlign: 'right' }]}>MOCKS</Text>
        <Text style={[headerCell, { width: COLUMNS.front, textAlign: 'right' }]}>AMCAT</Text>
        <Text style={[headerCell, { width: COLUMNS.exams, textAlign: 'right' }]}>EXAMS</Text>
      </View>
    </View>
  );
}

function TableRow({ row, index, origin }: { row: CampusReportRow; index: number; origin: string }) {
  const zone = zoneById(row.zone.zone);
  const amcat = row.metrics?.amcat?.at(-1);
  return (
    <View
      wrap={false}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 4,
        borderBottomWidth: 0.75,
        borderBottomColor: '#cbd5e1',
        borderBottomStyle: 'dotted',
        backgroundColor: index % 2 ? '#fbfcfe' : 'white',
      }}
    >
      <Text style={{ width: COLUMNS.index, color: MUTED }}>{index + 1}</Text>
      <View style={{ width: COLUMNS.student, paddingRight: 8 }}>
        <Text style={{ fontWeight: 600 }}>{row.name}</Text>
        <Text style={{ fontSize: 7, color: MUTED }}>{cohortLabel(row.course, row.batch)}</Text>
      </View>
      <View style={{ width: COLUMNS.basis }}>
        {row.zone.basis ? (
          <>
            <Text style={{ fontWeight: 700, color: zone.color }}>
              {formatNumber(row.zone.count ?? 0)} solved
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 7, color: MUTED, marginRight: 2.5 }}>on</Text>
              <PlatformMark origin={origin} id={row.zone.basis} size={7} />
              <Text style={{ fontSize: 7, color: MUTED }}>{platformName(row.zone.basis)}</Text>
            </View>
          </>
        ) : (
          <Text style={{ fontSize: 7.5, color: MUTED }}>No DSA profile</Text>
        )}
      </View>
      {PLATFORMS.map((platform) => {
        const value = row.values[platform.id];
        return (
          <Text
            key={platform.id}
            style={{
              width: COLUMNS.platform,
              textAlign: 'right',
              color: typeof value === 'number' ? INK : value === 'none' ? '#cbd5e1' : '#b45309',
              fontSize: typeof value === 'number' ? 9 : 7.5,
            }}
          >
            {cellText(value)}
          </Text>
        );
      })}
      <View style={{ width: COLUMNS.total, alignItems: 'flex-end' }}>
        <Text style={{ fontWeight: 700 }}>{formatNumber(row.total)}</Text>
      </View>
      <View style={{ width: COLUMNS.active, alignItems: 'flex-end' }}>
        <Text
          style={{
            fontSize: 8,
            color: (daysSince(row.lastActive) ?? 999) <= 7 ? '#15803d' : MUTED,
          }}
        >
          {lastActiveLabel(row.lastActive)}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          marginLeft: 5,
          borderLeftWidth: 0.75,
          borderLeftColor: LINE,
        }}
      >
        <FrontCell
          width={COLUMNS.front}
          value={row.metrics?.attendance}
          suffix="%"
          color={BAND_COLORS[bandOf(ATTENDANCE, row.metrics?.attendance)]}
          note={
            row.metrics?.prime_attendance != null
              ? `PRIME ${row.metrics.prime_attendance}%`
              : undefined
          }
        />
        <FrontCell
          width={COLUMNS.front}
          value={row.metrics?.test_avg}
          suffix="%"
          color={BAND_COLORS[bandOf(TESTS, row.metrics?.test_avg)]}
          note={
            row.metrics?.released
              ? `${row.metrics.submitted ?? 0} of ${row.metrics.released}`
              : undefined
          }
        />
        <FrontCell
          width={COLUMNS.front}
          value={amcat?.[1]}
          color={BAND_COLORS[bandOf(AMCAT, amcat?.[1])]}
          note={amcat ? monthOf(amcat[0]) : undefined}
        />
        <FrontCell
          width={COLUMNS.exams}
          value={row.metrics?.exam_avg}
          suffix="%"
          color={BAND_COLORS[bandOf(EXAMS, row.metrics?.exam_avg)]}
        />
      </View>
    </View>
  );
}

/** A score from the LMS with a small note under it, or a dash when there is none. */
function FrontCell({
  width,
  value,
  suffix = '',
  color,
  note,
}: {
  width: number;
  value: number | null | undefined;
  suffix?: string;
  color: string;
  note?: string;
}) {
  return (
    <View style={{ width, alignItems: 'flex-end' }}>
      {value == null ? (
        <Text style={{ color: '#cbd5e1' }}>—</Text>
      ) : (
        <Text style={{ fontWeight: 700, color }}>
          {formatNumber(value)}
          {suffix}
        </Text>
      )}
      {note ? <Text style={{ fontSize: 6, color: MUTED }}>{note}</Text> : null}
    </View>
  );
}
