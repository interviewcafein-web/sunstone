// The 360° pages of the campus reports: the five fronts (coding, attendance, PRIME tests,
// AMCAT, internal exams) for a group of students, its pain points, who needs attention, and
// a campus-by-campus comparison. Same model and thresholds as the website's 360° page.

import { Page, Text, View } from '@react-pdf/renderer';

import { cohortLabel } from '@/lib/cohorts';
import {
  BAND_COLORS,
  DIMENSIONS,
  bandOf,
  findPainPoints,
  groupBy,
  groupStats,
  type Dimension,
  type DimensionId,
  type DimensionStats,
  type GroupStats,
  type PainPoint,
  type Severity,
  type StudentInsight,
} from '@/lib/insights';
import {
  BandCell,
  BandLegend,
  INK,
  LINE,
  MUTED,
  NAVY,
  ReportFooter,
  base,
  formatNumber,
  frontValue,
  overallColor,
  tint,
} from '@/reports/shared';

const SEVERITY: Record<Severity, { label: string; color: string }> = {
  high: { label: 'HIGH', color: '#dc2626' },
  medium: { label: 'MEDIUM', color: '#d97706' },
  low: { label: 'LOW', color: '#64748b' },
};

const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** Students at risk on two fronts or more, most fronts first. */
export const needsAttention = (rows: StudentInsight[]) =>
  rows
    .filter((row) => row.risks.length >= 2)
    .sort((a, b) => b.risks.length - a.risks.length || (a.overall ?? 100) - (b.overall ?? 100));

/** Highest overall among students with data on three fronts or more. */
export const allRounders = (rows: StudentInsight[]) =>
  rows
    .filter((row) => DIMENSIONS.filter((d) => row.scores[d.id] !== null).length >= 3)
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));

/**
 * One page: overall health, the five fronts, the top pain points, and the students who need
 * attention next to the all-rounders. `groupKey` splits the students for the pain points that
 * compare groups (campuses in the all-campus summary, batches inside one campus).
 */
export function InsightsPage({
  title,
  insights,
  groupKey,
  groupNoun,
  showCampus,
  label,
}: {
  title: string;
  insights: StudentInsight[];
  groupKey: (row: StudentInsight) => string;
  groupNoun: string;
  /** Name the campus under each student (reports that span campuses). */
  showCampus: boolean;
  label: string;
}) {
  const scope = groupStats(title, insights);
  const groups = groupBy(insights, groupKey).filter((group) => group.students >= 5);
  const pains = findPainPoints(scope, groups, groupNoun).slice(0, 6);
  const attention = needsAttention(insights);
  const stars = allRounders(insights);
  const listSize = 8;

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={[base.page, { paddingTop: 26, paddingHorizontal: 32 }]}
      wrap
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}
      >
        <View style={{ flexGrow: 1, flexBasis: 0, paddingRight: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: 800 }}>360° Summary · {title}</Text>
          <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>
            Coding, attendance, PRIME Mock Tests, AMCAT and internal exams side by side for{' '}
            {formatNumber(scope.students)} students. Students with no data on a front are left out
            of it; coverage is the share with data.
          </Text>
        </View>
        <BandLegend />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <OverallTile stats={scope} />
        {DIMENSIONS.map((dimension) => (
          <DimensionTile
            key={dimension.id}
            dimension={dimension}
            stats={scope.dims[dimension.id]}
          />
        ))}
      </View>

      <Text style={[base.sectionTitle, { fontSize: 11, marginTop: 14, marginBottom: 6 }]}>
        Pain points
      </Text>
      {pains.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {pains.map((point, index) => (
            <PainPointItem key={index} point={point} />
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 8.5, color: MUTED }}>
          Nothing stands out: no front has more than one in ten students at risk.
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }} wrap={false}>
        <StudentList
          title="Students Who Need Attention"
          caption={`At risk on two fronts or more, most fronts first. ${formatNumber(attention.length)} students${attention.length > listSize ? `, first ${listSize} shown` : ''}.`}
          rows={attention.slice(0, listSize)}
          empty="No student is at risk on two fronts or more."
          showCampus={showCampus}
          accent="#dc2626"
        />
        <StudentList
          title="All-Rounders"
          caption="Highest overall score, with data on three fronts or more."
          rows={stars.slice(0, listSize)}
          empty="Not enough data yet."
          showCampus={showCampus}
          accent={BAND_COLORS.good}
        />
      </View>
      <ReportFooter label={label} />
    </Page>
  );
}

function OverallTile({ stats }: { stats: GroupStats }) {
  const color = overallColor(stats.overall);
  return (
    <View style={{ width: 120, backgroundColor: NAVY, borderRadius: 6, padding: 9 }}>
      <Text style={{ fontSize: 7, fontWeight: 600, color: '#b5cae6', letterSpacing: 0.6 }}>
        OVERALL HEALTH
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 3 }}>
        <Text
          style={{ fontSize: 22, fontWeight: 800, color: stats.overall === null ? 'white' : color }}
        >
          {stats.overall ?? '—'}
        </Text>
        <Text style={{ fontSize: 8, color: '#b5cae6', marginLeft: 3, marginBottom: 4 }}>/ 100</Text>
      </View>
      <Text style={{ fontSize: 6.5, color: '#b5cae6' }}>Average across the five fronts</Text>
      <View
        style={{
          marginTop: 7,
          backgroundColor: 'rgba(239,68,68,0.3)',
          borderRadius: 8,
          paddingVertical: 2.5,
          paddingHorizontal: 6,
        }}
      >
        <Text style={{ fontSize: 7, fontWeight: 700, color: '#fee2e2' }}>
          {formatNumber(stats.critical)} of {formatNumber(stats.students)} at risk on 3+
        </Text>
      </View>
    </View>
  );
}

function DimensionTile({ dimension, stats }: { dimension: Dimension; stats: DimensionStats }) {
  const band = bandOf(dimension, stats.avg);
  const total = stats.good + stats.ok + stats.risk;
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 0,
        borderWidth: 0.75,
        borderColor: LINE,
        borderTopWidth: 2.5,
        borderTopColor: dimension.color,
        borderRadius: 6,
        padding: 8,
      }}
    >
      <Text style={{ fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.6 }}>
        {dimension.label.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 }}>
        <Text style={{ fontSize: 17, fontWeight: 800, color: BAND_COLORS[band] }}>
          {frontValue(dimension, stats.avg)}
        </Text>
        <Text style={{ fontSize: 6.5, color: MUTED, marginLeft: 4, marginBottom: 3 }}>
          {dimension.id === 'coding' ? 'avg solved (capped at 100)' : 'average'}
        </Text>
      </View>
      {/* Doing well / average / at risk, as one stacked bar. */}
      <View
        style={{
          flexDirection: 'row',
          height: 5,
          borderRadius: 2.5,
          overflow: 'hidden',
          marginTop: 5,
          backgroundColor: '#eef2f6',
        }}
      >
        {total > 0 &&
          (['good', 'ok', 'risk'] as const).map((key) =>
            stats[key] ? (
              <View key={key} style={{ flexGrow: stats[key], backgroundColor: BAND_COLORS[key] }} />
            ) : null
          )}
      </View>
      <Text style={{ fontSize: 6.5, color: INK, marginTop: 4 }}>
        <Text style={{ color: BAND_COLORS.good, fontWeight: 700 }}>{formatNumber(stats.good)}</Text>{' '}
        well ·{' '}
        <Text style={{ color: BAND_COLORS.ok, fontWeight: 700 }}>{formatNumber(stats.ok)}</Text>{' '}
        average ·{' '}
        <Text style={{ color: BAND_COLORS.risk, fontWeight: 700 }}>{formatNumber(stats.risk)}</Text>{' '}
        at risk
      </Text>
      <Text style={{ fontSize: 6.5, color: stats.coverage < 60 ? '#b45309' : MUTED, marginTop: 2 }}>
        Data for {stats.coverage}% ({formatNumber(stats.n)} students)
      </Text>
      <Text style={{ fontSize: 6, color: MUTED, marginTop: 2 }}>
        Well from {dimension.good}
        {dimension.suffix} · at risk under {dimension.risk}
        {dimension.suffix}
      </Text>
    </View>
  );
}

function PainPointItem({ point }: { point: PainPoint }) {
  const severity = SEVERITY[point.severity];
  const dimension = DIMENSIONS.find((item) => item.id === point.dimension);
  return (
    <View
      wrap={false}
      style={{
        width: 385,
        flexDirection: 'row',
        borderLeftWidth: 3,
        borderLeftColor: severity.color,
        backgroundColor: tint(severity.color, 0.06),
        borderRadius: 4,
        paddingVertical: 5,
        paddingHorizontal: 7,
      }}
    >
      <View style={{ width: 46 }}>
        <Text style={{ fontSize: 6.5, fontWeight: 800, color: severity.color, letterSpacing: 0.5 }}>
          {severity.label}
        </Text>
        {dimension ? (
          <Text style={{ fontSize: 6, color: MUTED, marginTop: 1.5 }}>{dimension.short}</Text>
        ) : null}
      </View>
      <View style={{ flexGrow: 1, flexBasis: 0 }}>
        <Text style={{ fontSize: 8.5, fontWeight: 700 }}>{point.title}</Text>
        <Text style={{ fontSize: 7, color: '#334155', marginTop: 1.5 }}>{point.detail}</Text>
      </View>
    </View>
  );
}

/** Short column titles for the student lists. */
const COLUMN_LABELS: Record<DimensionId, string> = {
  coding: 'SOLVED',
  attendance: 'ATTEND.',
  tests: 'MOCKS',
  amcat: 'AMCAT',
  exams: 'EXAMS',
};

const LIST = { rank: 14, student: 126, front: 38, overall: 34 };
const listHead = { fontSize: 6, fontWeight: 700, color: MUTED, letterSpacing: 0.3 } as const;

function StudentList({
  title,
  caption,
  rows,
  empty,
  showCampus,
  accent,
}: {
  title: string;
  caption: string;
  rows: StudentInsight[];
  empty: string;
  showCampus: boolean;
  accent: string;
}) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 3, height: 11, backgroundColor: accent, marginRight: 5 }} />
        <Text style={{ fontSize: 11, fontWeight: 700 }}>{title}</Text>
      </View>
      <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>{caption}</Text>
      {rows.length === 0 ? (
        <Text style={{ fontSize: 8, color: MUTED, marginTop: 6 }}>{empty}</Text>
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: 4,
              marginTop: 4,
              borderBottomWidth: 0.75,
              borderBottomColor: INK,
            }}
          >
            <Text style={[listHead, { width: LIST.rank }]}>#</Text>
            <Text style={[listHead, { width: LIST.student }]}>STUDENT</Text>
            {DIMENSIONS.map((dimension) => (
              <Text
                key={dimension.id}
                style={[listHead, { width: LIST.front, textAlign: 'center' }]}
              >
                {COLUMN_LABELS[dimension.id]}
              </Text>
            ))}
            <Text style={[listHead, { width: LIST.overall, textAlign: 'center' }]}>OVERALL</Text>
          </View>
          {rows.map((row, index) => (
            <View
              key={row.student.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 2.5,
                borderBottomWidth: 0.5,
                borderBottomColor: LINE,
              }}
            >
              <Text style={{ width: LIST.rank, fontSize: 7.5, color: MUTED }}>{index + 1}</Text>
              <View style={{ width: LIST.student, paddingRight: 4 }}>
                {/* One line each, so the lists keep their height and stay on the page. */}
                <Text
                  style={{ fontSize: 8, fontWeight: 600, maxLines: 1, textOverflow: 'ellipsis' }}
                >
                  {row.student.name}
                </Text>
                <Text style={{ fontSize: 6, color: MUTED, maxLines: 1, textOverflow: 'ellipsis' }}>
                  {[
                    showCampus && row.student.campus,
                    cohortLabel(row.student.course, row.student.batch),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {DIMENSIONS.map((dimension) => {
                const value = row.scores[dimension.id];
                // Coding shows the real solved count; the score is capped at 100.
                const shown = dimension.id === 'coding' && row.solved !== null ? row.solved : value;
                return (
                  <BandCell
                    key={dimension.id}
                    width={LIST.front}
                    text={shown === null ? null : frontValue(dimension, shown)}
                    color={BAND_COLORS[bandOf(dimension, value)]}
                  />
                );
              })}
              <BandCell
                width={LIST.overall}
                text={row.overall === null ? null : String(row.overall)}
                color={overallColor(row.overall)}
                strong
              />
            </View>
          ))}
        </>
      )}
    </View>
  );
}

/** Campuses side by side on the five fronts, coloured by band, highest overall first. */
export function HealthComparisonPage({
  insights,
  label,
}: {
  insights: StudentInsight[];
  label: string;
}) {
  const everyone = groupStats('All Campuses', insights);
  const campuses = groupBy(insights, (row) => row.student.campus).sort(
    (a, b) => (b.overall ?? -1) - (a.overall ?? -1) || b.students - a.students
  );
  const widths = { index: 18, campus: 214, students: 50, overall: 58, front: 72, critical: 64 };
  const head = { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.4 } as const;

  const row = (group: GroupStats, index: number | null) => {
    const criticalShare = share(group.critical, group.students);
    return (
      <View
        key={group.key}
        wrap={false}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 3,
          paddingHorizontal: 4,
          borderBottomWidth: index === null ? 1 : 0.75,
          borderBottomColor: index === null ? INK : '#cbd5e1',
          borderBottomStyle: index === null ? 'solid' : 'dotted',
          backgroundColor: index === null ? '#f1f5f9' : index % 2 ? '#fbfcfe' : 'white',
        }}
      >
        <Text style={{ width: widths.index, color: MUTED, fontSize: 7.5 }}>
          {index === null ? '' : index + 1}
        </Text>
        <Text
          style={{ width: widths.campus, fontWeight: index === null ? 800 : 600, paddingRight: 8 }}
        >
          {group.key}
        </Text>
        <Text style={{ width: widths.students, textAlign: 'right', paddingRight: 6 }}>
          {formatNumber(group.students)}
        </Text>
        <BandCell
          width={widths.overall}
          text={group.overall === null ? null : String(group.overall)}
          color={overallColor(group.overall)}
          strong
        />
        {DIMENSIONS.map((dimension) => {
          const stats = group.dims[dimension.id];
          return (
            <BandCell
              key={dimension.id}
              width={widths.front}
              text={stats.avg === null ? null : frontValue(dimension, stats.avg)}
              color={BAND_COLORS[bandOf(dimension, stats.avg)]}
              note={
                stats.avg !== null && stats.coverage < 60 ? `${stats.coverage}% data` : undefined
              }
            />
          );
        })}
        <View style={{ width: widths.critical, alignItems: 'flex-end' }}>
          <Text
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: criticalShare >= 10 ? '#b91c1c' : MUTED,
            }}
          >
            {criticalShare}%
          </Text>
          <Text style={{ fontSize: 6, color: MUTED }}>{formatNumber(group.critical)} students</Text>
        </View>
      </View>
    );
  };

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={[base.page, { paddingTop: 28, paddingHorizontal: 32 }]}
      wrap
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}
      >
        <View style={{ flexGrow: 1, flexBasis: 0, paddingRight: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: 800 }}>Campus Comparison: 360°</Text>
          <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>
            Average on each front, highest overall first. A small note under a cell means fewer than
            60% of the campus have data on that front.
          </Text>
        </View>
        <BandLegend />
      </View>

      <View
        fixed
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 6,
          paddingHorizontal: 4,
          marginTop: 10,
          borderBottomWidth: 1,
          borderBottomColor: INK,
        }}
      >
        <Text style={[head, { width: widths.index }]}>#</Text>
        <Text style={[head, { width: widths.campus }]}>CAMPUS</Text>
        <Text style={[head, { width: widths.students, textAlign: 'right', paddingRight: 6 }]}>
          STUDENTS
        </Text>
        <Text style={[head, { width: widths.overall, textAlign: 'center' }]}>OVERALL</Text>
        {DIMENSIONS.map((dimension) => (
          <Text key={dimension.id} style={[head, { width: widths.front, textAlign: 'center' }]}>
            {dimension.short.toUpperCase()}
          </Text>
        ))}
        <Text style={[head, { width: widths.critical, textAlign: 'right' }]}>AT RISK 3+</Text>
      </View>
      {row(everyone, null)}
      {campuses.map((group, index) => row(group, index))}
      <ReportFooter label={label} />
    </Page>
  );
}
