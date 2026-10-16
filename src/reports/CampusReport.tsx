import { Document, Image, Page, Text, View } from '@react-pdf/renderer';

import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import type { PlatformId } from '@/lib/coding-profiles/types';
import { ZONE_BASIS, ZONES, zoneById, type ZoneResult } from '@/lib/students/zones';
import {
  INK,
  LINE,
  MUTED,
  ReportFooter,
  ReportHeader,
  SOFT,
  StatTile,
  base,
  formatDate,
  formatNumber,
} from '@/reports/shared';

/** What a platform cell shows: a count, or why there is none. */
export type ReportValue = number | 'none' | 'invalid' | 'not_found' | 'error';

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
}

export interface CampusReportData {
  origin: string;
  /** Campus name, or "All campuses". */
  title: string;
  /** Other filters in force, e.g. ["Batch 2027", "B.Tech"]. */
  filters: string[];
  generatedAt: Date;
  rows: CampusReportRow[];
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
  return '—';
}

// Column widths for the zone tables, in points (A4 landscape leaves ~778pt inside margins).
const COLUMNS = {
  index: 22,
  student: 180,
  basis: 86,
  platform: 60,
  total: 52,
  active: 64,
};

export function CampusReport({ data }: { data: CampusReportData }) {
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
  const label = [data.title, ...data.filters].join(' · ');

  return (
    <Document
      title={`Coding Profile Report – ${label}`}
      author="Sunstone PRIME"
      subject="Students by coding practice zone"
    >
      {/* ── Summary page ── */}
      <Page size="A4" orientation="landscape" style={base.page}>
        <ReportHeader
          origin={data.origin}
          kind="Campus Coding Report"
          generatedAt={data.generatedAt}
        />
        <View style={{ paddingHorizontal: 32, paddingTop: 18 }}>
          <Text style={{ fontSize: 22, fontWeight: 800 }}>{data.title}</Text>
          <Text style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
            {[
              ...data.filters,
              `${formatNumber(rows.length)} students`,
              formatDate(data.generatedAt),
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
                      {[row.course, row.batch && `Batch ${row.batch}`].filter(Boolean).join(' · ')}
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

      {/* ── One section per zone ── */}
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
    </Document>
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
        <View
          key={platform.id}
          style={{
            width: COLUMNS.platform,
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <PlatformMark origin={origin} id={platform.id} />
          <Text style={headerCell}>{SHORT[platform.id]}</Text>
        </View>
      ))}
      <Text style={[headerCell, { width: COLUMNS.total, textAlign: 'right' }]}>TOTAL</Text>
      <Text style={[headerCell, { width: COLUMNS.active, textAlign: 'right' }]}>LAST ACTIVE</Text>
    </View>
  );
}

function TableRow({ row, index, origin }: { row: CampusReportRow; index: number; origin: string }) {
  const zone = zoneById(row.zone.zone);
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
        <Text style={{ fontSize: 7, color: MUTED }}>
          {[row.course, row.batch && `Batch ${row.batch}`].filter(Boolean).join(' · ')}
        </Text>
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
    </View>
  );
}
