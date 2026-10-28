import { Document, Image, Page, Text, View } from '@react-pdf/renderer';

import type { StudentAssessmentsData, StudentMetrics } from '@/lib/assessments';
import { activityWindows, mergeCalendars, streaksOf } from '@/lib/coding-profiles/activity';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import type { CodingProfile, PlatformId } from '@/lib/coding-profiles/types';
import { BAND_COLORS, DIMENSIONS, bandOf, type StudentInsight } from '@/lib/insights';
import { zoneById, zoneOf } from '@/lib/students/zones';
import { AssessmentPages, AssessmentSections } from '@/reports/StudentAssessments';
import {
  BAND_LABELS,
  Bar,
  LINE,
  MUTED,
  ReportFooter,
  ReportHeader,
  SOFT,
  StatTile,
  base,
  formatNumber,
  frontValue,
  overallColor,
  tint,
} from '@/reports/shared';

export interface StudentReportData {
  origin: string;
  name: string;
  campus?: string;
  course?: string;
  batch?: string;
  generatedAt: Date;
  profiles: CodingProfile[];
  /** The five fronts of the 360° view; only for students on the sheet, seen by staff. */
  insight?: StudentInsight;
  /** The student's line in the LMS metrics (attendance, tests, AMCAT, exams). */
  metrics?: StudentMetrics;
  /** PRIME tests, exams, AMCAT sittings and attendance from the LMS. */
  assessments?: StudentAssessmentsData;
}

const HEAT = ['#eef2f6', '#b5cae6', '#86a6d3', '#3863a0', '#1a3e70'];
const level = (count: number) =>
  count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;
// Inter (as embedded) has no ★, so star counts are spelled out in the PDF.
const stars = (value: string) =>
  value.replace(/(\d+)\/(\d+)★/g, '$1 of $2 stars').replace(/(\d+)★/g, '$1 stars');

const platformOf = (id: PlatformId) => PLATFORMS.find((platform) => platform.id === id)!;

export function StudentReport({ data }: { data: StudentReportData }) {
  const { profiles } = data;
  const calendar = mergeCalendars(profiles.map((profile) => profile.calendar));
  const streaks = streaksOf(calendar);
  const windows = activityWindows(calendar);
  const solved = profiles.reduce((sum, profile) => sum + (profile.solved ?? 0), 0);
  const contests = profiles.reduce((sum, profile) => sum + (profile.rating?.contests ?? 0), 0);
  const rated = profiles
    .filter((profile) => profile.rating?.current)
    .sort((a, b) => b.rating!.current! - a.rating!.current!);
  const zone = zoneOf(
    Object.fromEntries(
      profiles
        .filter((profile) => profile.solved !== null)
        .map((profile) => [profile.platform, profile.solved!])
    )
  );
  const zoneInfo = zoneById(zone.zone);
  const subtitle = [data.campus, data.course, data.batch && `Batch ${data.batch}`]
    .filter(Boolean)
    .join('  ·  ');

  // Last 53 weeks, Sunday-aligned columns, like the website's heatmap.
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 52 * 7 - end.getUTCDay());
  const weeks: { date: string; count: number }[][] = [];
  for (const day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() === 0) weeks.push([]);
    const date = day.toISOString().slice(0, 10);
    weeks[weeks.length - 1].push({ date, count: calendar[date] || 0 });
  }

  return (
    <Document
      title={`Sunstone PRIME Vertex – ${data.name} – Progress Report`}
      author="Sunstone PRIME"
    >
      <Page size="A4" style={base.page}>
        <ReportHeader
          origin={data.origin}
          kind="Student Progress Report"
          generatedAt={data.generatedAt}
        />
        <View style={{ paddingHorizontal: 32, paddingTop: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <View style={{ maxWidth: 330 }}>
              <Text style={{ fontSize: 22, fontWeight: 800 }}>{data.name}</Text>
              {subtitle ? (
                <Text style={{ fontSize: 9.5, color: MUTED, marginTop: 4 }}>{subtitle}</Text>
              ) : null}
            </View>
            <View
              style={{
                backgroundColor: zoneInfo.tint,
                borderLeftWidth: 4,
                borderLeftColor: zoneInfo.color,
                borderRadius: 6,
                paddingVertical: 6,
                paddingHorizontal: 10,
                alignItems: 'flex-end',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: 800, color: zoneInfo.color }}>
                {zoneInfo.label}
              </Text>
              {zone.basis ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Text style={{ fontSize: 7.5, color: '#334155', marginRight: 3 }}>
                    {formatNumber(zone.count ?? 0)} solved on
                  </Text>
                  <Image
                    src={`${data.origin}/reports/platforms/${zone.basis}.png`}
                    style={{ width: 8, height: 8, marginRight: 2.5, objectFit: 'contain' }}
                  />
                  <Text style={{ fontSize: 7.5, color: '#334155' }}>
                    {platformOf(zone.basis).name}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 7.5, color: '#334155', marginTop: 2 }}>
                  No usable DSA profile
                </Text>
              )}
            </View>
          </View>

          {data.insight ? <FrontsStrip insight={data.insight} metrics={data.metrics} /> : null}

          <Text style={[base.sectionTitle, { marginTop: 16, marginBottom: 0 }]}>
            Coding practice
          </Text>
          {profiles.length === 0 ? (
            <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 6 }}>
              No coding profile to show: no username on any platform, or none could be loaded.
            </Text>
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                <StatTile
                  width="32%"
                  label="Problems solved"
                  value={formatNumber(solved)}
                  hint="all platforms"
                />
                <StatTile
                  width="32%"
                  label="Active days"
                  value={formatNumber(streaks.activeDays)}
                />
                <StatTile
                  width="32%"
                  label="Streak"
                  value={`${streaks.current}d`}
                  hint={`best ${streaks.best} days`}
                />
                <StatTile width="32%" label="Contests" value={formatNumber(contests)} />
                <StatTile
                  width="32%"
                  label="Top contest rating"
                  value={rated[0] ? formatNumber(rated[0].rating!.current!) : '—'}
                  hint={rated[0] ? platformOf(rated[0].platform).name : 'no rated contests'}
                />
                <StatTile
                  width="32%"
                  label="Last 30 days"
                  value={formatNumber(windows[2].value)}
                  hint={`submissions · ${formatNumber(windows[1].value)} in the last 7 days`}
                />
              </View>

              {/* Activity heatmap */}
              <View style={{ marginTop: 16, backgroundColor: SOFT, borderRadius: 8, padding: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 8 }}>
                  Activity in the last year, all platforms
                </Text>
                <View style={{ flexDirection: 'row', gap: 1.6 }}>
                  {weeks.map((week, index) => (
                    <View key={index} style={{ gap: 1.6 }}>
                      {week.map((day) => (
                        <View
                          key={day.date}
                          style={{
                            width: 6.6,
                            height: 6.6,
                            borderRadius: 1.2,
                            backgroundColor: HEAT[level(day.count)],
                          }}
                        />
                      ))}
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 7.5, color: MUTED, marginTop: 6 }}>
                  {formatNumber(streaks.activeDays)} active days · best streak {streaks.best} ·
                  current streak {streaks.current}
                </Text>
              </View>

              <Text style={[base.sectionTitle, { marginTop: 18 }]}>Platforms</Text>
              {profiles.map((profile) => (
                <PlatformSection key={profile.platform} profile={profile} origin={data.origin} />
              ))}
            </>
          )}
          {/* Without coding profiles, the LMS record follows on the same page. */}
          {data.assessments && profiles.length === 0 ? (
            <AssessmentSections assessments={data.assessments} metrics={data.metrics} />
          ) : null}
        </View>
        <ReportFooter label={data.name} />
      </Page>
      {data.assessments && profiles.length > 0 ? (
        <AssessmentPages assessments={data.assessments} metrics={data.metrics} name={data.name} />
      ) : null}
    </Document>
  );
}

/** The overall score and the five fronts, each coloured by its band. */
function FrontsStrip({ insight, metrics }: { insight: StudentInsight; metrics?: StudentMetrics }) {
  const notes: Record<string, string | undefined> = {
    coding: insight.solved !== null ? `${formatNumber(insight.solved)} solved` : 'No DSA profile',
    attendance:
      metrics?.prime_attendance != null ? `PRIME ${metrics.prime_attendance}%` : undefined,
    tests: metrics?.released
      ? `${metrics.submitted ?? 0} of ${metrics.released} submitted`
      : undefined,
    amcat: metrics?.amcat?.length
      ? `${metrics.amcat.length} sitting${metrics.amcat.length === 1 ? '' : 's'}`
      : 'Not taken yet',
    exams: 'Midterms, end-term',
  };
  const overall = overallColor(insight.overall);
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[base.sectionTitle, { marginBottom: 6 }]}>360° view</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View
          style={{
            flexGrow: 1,
            flexBasis: 0,
            backgroundColor: tint(overall, 0.1),
            borderRadius: 6,
            borderTopWidth: 2.5,
            borderTopColor: overall,
            padding: 7,
          }}
        >
          <Text style={{ fontSize: 6.5, fontWeight: 700, color: MUTED, letterSpacing: 0.5 }}>
            OVERALL
          </Text>
          <Text style={{ fontSize: 16, fontWeight: 800, color: overall, marginTop: 2 }}>
            {insight.overall ?? '—'}
          </Text>
          <Text style={{ fontSize: 6, color: MUTED, marginTop: 1 }}>
            {insight.risks.length
              ? `At risk on ${insight.risks.length} front${insight.risks.length === 1 ? '' : 's'}`
              : 'Average of the fronts'}
          </Text>
        </View>
        {DIMENSIONS.map((dimension) => {
          const value = insight.scores[dimension.id];
          const band = bandOf(dimension, value);
          const shown =
            dimension.id === 'coding' && insight.solved !== null ? insight.solved : value;
          return (
            <View
              key={dimension.id}
              style={{
                flexGrow: 1,
                flexBasis: 0,
                borderWidth: 0.75,
                borderColor: LINE,
                borderTopWidth: 2.5,
                borderTopColor: dimension.color,
                borderRadius: 6,
                padding: 7,
              }}
            >
              <Text style={{ fontSize: 6.5, fontWeight: 700, color: MUTED, letterSpacing: 0.5 }}>
                {dimension.short.toUpperCase()}
              </Text>
              <Text
                style={{ fontSize: 14, fontWeight: 800, color: BAND_COLORS[band], marginTop: 2 }}
              >
                {frontValue(dimension, shown)}
              </Text>
              <Text style={{ fontSize: 6.5, fontWeight: 700, color: BAND_COLORS[band] }}>
                {BAND_LABELS[band]}
              </Text>
              {notes[dimension.id] ? (
                <Text style={{ fontSize: 6, color: MUTED, marginTop: 1 }}>
                  {notes[dimension.id]}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 4 }}>
        Doing well from / at risk under:{' '}
        {DIMENSIONS.map(
          (dimension) =>
            `${dimension.short} ${dimension.good}${dimension.suffix} / ${dimension.risk}${dimension.suffix}`
        ).join(' · ')}
        . Coding counts the best solved count on one DSA platform.
      </Text>
    </View>
  );
}

function PlatformSection({ profile, origin }: { profile: CodingProfile; origin: string }) {
  const platform = platformOf(profile.platform);
  const rows = profile.difficulty.flatMap((group) => group.rows);
  const maxRow = Math.max(1, ...rows.map((row) => row.total ?? row.solved));

  return (
    <View
      wrap={false}
      style={{
        borderWidth: 0.75,
        borderColor: LINE,
        borderLeftWidth: 4,
        borderLeftColor: platform.color,
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            src={`${origin}/reports/platforms/${platform.id}.png`}
            style={{ width: 13, height: 13, marginRight: 5, objectFit: 'contain' }}
          />
          <Text style={{ fontSize: 11, fontWeight: 700 }}>
            {platform.name}
            {profile.rankTitle ? `  ·  ${stars(profile.rankTitle)}` : ''}
          </Text>
        </View>
        <Text style={{ fontSize: 8, color: MUTED }}>@{profile.username}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {profile.kpis.map((kpi) => (
          <View
            key={kpi.label}
            style={{ width: '24%', backgroundColor: SOFT, borderRadius: 4, padding: 6 }}
          >
            <Text style={{ fontSize: 6.5, color: MUTED, fontWeight: 600 }}>
              {kpi.label.toUpperCase()}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
              {kpi.value === null
                ? '—'
                : typeof kpi.value === 'number'
                  ? formatNumber(kpi.value)
                  : kpi.value}
            </Text>
            {kpi.hint ? (
              <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 1 }}>{stars(kpi.hint)}</Text>
            ) : null}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
        {rows.length > 0 && (
          <View style={{ width: '48%' }}>
            <Text style={{ fontSize: 8, fontWeight: 700, marginBottom: 4 }}>
              {profile.difficulty.length > 1 ? 'Solved by level' : profile.difficulty[0].title}
            </Text>
            {rows.map((row) => (
              <View
                key={row.label}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}
              >
                <Text style={{ width: 62, fontSize: 7.5 }}>{row.label}</Text>
                <Bar share={row.solved / maxRow} color={row.color} width={120} />
                <Text style={{ fontSize: 7.5, marginLeft: 6, color: MUTED }}>
                  {formatNumber(row.solved)}
                  {row.total ? ` / ${formatNumber(row.total)}` : ''}
                  {row.acceptance !== undefined ? ` · ${row.acceptance}%` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
        {profile.topics.length > 0 && (
          <View style={{ width: '48%' }}>
            <Text style={{ fontSize: 8, fontWeight: 700, marginBottom: 4 }}>
              {profile.topicsLabel ?? 'Strongest topics'}
            </Text>
            {profile.topics.slice(0, 5).map((topic) => (
              <View
                key={topic.label}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}
              >
                <Text style={{ width: 90, fontSize: 7.5 }}>{topic.label}</Text>
                <Bar
                  share={topic.count / profile.topics[0].count}
                  color={platform.color}
                  width={90}
                />
                <Text style={{ fontSize: 7.5, marginLeft: 6, color: MUTED }}>
                  {formatNumber(topic.count)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {profile.rating ? (
        <Text style={{ fontSize: 8, marginTop: 6, color: '#334155' }}>
          Contest rating {profile.rating.current ? formatNumber(profile.rating.current) : '—'}
          {profile.rating.max ? ` (best ${formatNumber(profile.rating.max)})` : ''} ·{' '}
          {profile.rating.contests} contests
        </Text>
      ) : null}
      {profile.certificates.length > 0 && (
        <Text style={{ fontSize: 8, marginTop: 4, color: '#15803d' }}>
          Verified certificates:{' '}
          {profile.certificates.map((certificate) => certificate.name).join(', ')}
        </Text>
      )}
      {profile.badges.length > 0 && (
        <Text style={{ fontSize: 8, marginTop: 4, color: '#334155' }}>
          Badges ({profile.badges.length}):{' '}
          {profile.badges
            .slice(0, 6)
            .map((badge) => badge.name)
            .join(', ')}
          {profile.badges.length > 6 ? ', …' : ''}
        </Text>
      )}
    </View>
  );
}
