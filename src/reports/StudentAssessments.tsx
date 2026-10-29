// The LMS half of the student report: PRIME tests, AMCAT, internal exams and attendance,
// laid out like the student's Assessments and Attendance tabs on the website.

import { Page, Text, View } from '@react-pdf/renderer';

import {
  CATEGORY_LABELS,
  EXAM_KIND_LABELS,
  examEventLabel,
  lmsDate,
  percent,
  type AmcatSitting,
  type StudentAssessmentsData,
  type StudentExam,
  type StudentMetrics,
  type StudentTest,
} from '@/lib/assessments';
import { BAND_COLORS, bandOf, dimensionById, type DimensionId } from '@/lib/insights';
import {
  INK,
  LINE,
  MUTED,
  ReportFooter,
  SOFT,
  StatTile,
  base,
  formatNumber,
  tint,
} from '@/reports/shared';

const RECENT_TESTS = 12;

/** Colour of a score on one of the 360° fronts. */
const colorOn = (front: DimensionId, value: number | null | undefined) =>
  BAND_COLORS[bandOf(dimensionById(front), value)];

const mean = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

const place = (test: StudentTest) =>
  [test.module, test.lecture].filter(Boolean).join(' › ') || test.subject || 'Prime Domain Coding';

/** "2026-06-29" → "29 Jun". */
const shortDate = (value: string | null) => lmsDate(value).replace(/ \d{4}$/, '');

/** The LMS record on its own page, after the coding pages. */
export function AssessmentPages({
  assessments,
  metrics,
  name,
}: {
  assessments: StudentAssessmentsData;
  metrics?: StudentMetrics;
  name: string;
}) {
  return (
    <Page size="A4" style={[base.page, { paddingTop: 28, paddingHorizontal: 32 }]} wrap>
      <AssessmentSections assessments={assessments} metrics={metrics} first />
      <ReportFooter label={name} />
    </Page>
  );
}

/** Title, then PRIME tests, AMCAT, internal exams and attendance. */
export function AssessmentSections({
  assessments,
  metrics,
  first = false,
}: {
  assessments: StudentAssessmentsData;
  metrics?: StudentMetrics;
  /** Opens its own page (a larger title, no space above). */
  first?: boolean;
}) {
  const { syncedAt } = assessments;
  return (
    <>
      <Text style={{ fontSize: first ? 16 : 12, fontWeight: 800, marginTop: first ? 0 : 18 }}>
        Assessments and attendance
      </Text>
      <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>
        PRIME Mock Tests, AMCAT, internal exams and class attendance from the LMS
        {syncedAt ? `, as of ${lmsDate(syncedAt, true)}` : ''}.
      </Text>
      <TestsSection tests={assessments.tests} />
      <AmcatSection sittings={assessments.amcat} />
      <ExamsSection exams={assessments.exams} average={metrics?.exam_avg ?? null} />
      <AttendanceSection attendance={assessments.attendance} />
    </>
  );
}

function SectionTitle({ title, aside, color }: { title: string; aside?: string; color: string }) {
  return (
    <View
      minPresenceAhead={60}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 18,
        marginBottom: 8,
        paddingBottom: 4,
        borderBottomWidth: 1.5,
        borderBottomColor: color,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: 700 }}>{title}</Text>
      {aside ? <Text style={{ fontSize: 7.5, color: MUTED }}>{aside}</Text> : null}
    </View>
  );
}

const head = { fontSize: 6.5, fontWeight: 700, color: MUTED, letterSpacing: 0.4 } as const;

function HeadRow({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 4,
        paddingHorizontal: 4,
        borderBottomWidth: 0.75,
        borderBottomColor: INK,
      }}
    >
      {children}
    </View>
  );
}

function Row({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <View
      wrap={false}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: '#cbd5e1',
        borderBottomStyle: 'dotted',
        backgroundColor: index % 2 ? '#fbfcfe' : 'white',
      }}
    >
      {children}
    </View>
  );
}

/** The student's score as a bar, with a dark tick at the class average. */
function ScoreBar({
  value,
  classAvg,
  color,
  width,
}: {
  value: number | null;
  classAvg: number | null;
  color: string;
  width: number;
}) {
  return (
    <View style={{ width, height: 6, backgroundColor: '#eef2f6', borderRadius: 3 }}>
      {value !== null ? (
        <View
          style={{
            width: (Math.max(0, Math.min(100, value)) / 100) * width,
            height: 6,
            backgroundColor: color,
            borderRadius: 3,
          }}
        />
      ) : null}
      {classAvg !== null ? (
        <View
          style={{
            position: 'absolute',
            left: (Math.max(0, Math.min(100, classAvg)) / 100) * width - 0.75,
            top: -2,
            width: 1.5,
            height: 10,
            backgroundColor: INK,
          }}
        />
      ) : null}
    </View>
  );
}

function Empty({ children }: { children: string }) {
  return <Text style={{ fontSize: 8.5, color: MUTED }}>{children}</Text>;
}

// ── PRIME tests ───────────────────────────────────────────────────────────────────────────

const TEST_COLUMNS = { test: 196, released: 56, score: 58, bar: 110, classAvg: 46, rank: 50 };

function TestsSection({ tests }: { tests: StudentTest[] }) {
  const released = tests.filter((test) => test.status === 'completed' || test.status === 'live');
  const submitted = tests.filter((test) => test.submitted);
  const average = mean(submitted.map((test) => test.pct ?? 0));
  const classAverage = mean(
    submitted.map((test) => test.class_avg_pct).filter((value): value is number => value !== null)
  );
  const gap = average !== null && classAverage !== null ? average - classAverage : null;
  const recent = [...released]
    .sort((a, b) => (b.released_at ?? '').localeCompare(a.released_at ?? ''))
    .slice(0, RECENT_TESTS);
  const color = dimensionById('tests').color;

  return (
    <>
      <SectionTitle
        title="PRIME Mock Tests"
        aside="Prime Domain Coding tests and assignments"
        color={color}
      />
      {released.length === 0 ? (
        <Empty>No PRIME Mock Tests have been released to this student yet.</Empty>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile
              width="32%"
              label="Average score"
              value={average === null ? '—' : `${average}%`}
              hint={
                gap === null
                  ? 'on submitted tests'
                  : `${gap >= 0 ? '+' : ''}${gap} points vs class average (${classAverage}%)`
              }
              color={colorOn('tests', average)}
            />
            <StatTile
              width="32%"
              label="Submitted"
              value={`${submitted.length} of ${released.length}`}
              hint={`${percent(submitted.length, released.length)}% of released tests`}
              color={color}
            />
            <StatTile
              width="32%"
              label="Not submitted"
              value={formatNumber(released.filter((test) => !test.submitted).length)}
              hint="released tests with no submission"
              color={color}
            />
          </View>

          <Text style={{ fontSize: 9, fontWeight: 700, marginTop: 12, marginBottom: 2 }}>
            Recent tests
            <Text style={{ fontWeight: 400, color: MUTED }}>
              {' '}
              · latest {recent.length} of {released.length}, newest first; the dark tick marks the
              class average
            </Text>
          </Text>
          <HeadRow>
            <Text style={[head, { width: TEST_COLUMNS.test }]}>TEST</Text>
            <Text style={[head, { width: TEST_COLUMNS.released }]}>RELEASED</Text>
            <Text style={[head, { width: TEST_COLUMNS.score, textAlign: 'right' }]}>SCORE</Text>
            <Text style={[head, { width: TEST_COLUMNS.bar, paddingLeft: 10 }]}>VS CLASS</Text>
            <Text style={[head, { width: TEST_COLUMNS.classAvg, textAlign: 'right' }]}>CLASS</Text>
            <Text style={[head, { width: TEST_COLUMNS.rank, textAlign: 'right' }]}>RANK</Text>
          </HeadRow>
          {recent.map((test, index) => (
            <Row key={test.id} index={index}>
              <View style={{ width: TEST_COLUMNS.test, paddingRight: 6 }}>
                <Text style={{ fontWeight: 600, fontSize: 8.5 }}>{test.name}</Text>
                <Text style={{ fontSize: 6.5, color: MUTED }}>
                  {CATEGORY_LABELS[test.category]} · {place(test)}
                </Text>
              </View>
              <Text style={{ width: TEST_COLUMNS.released, fontSize: 7.5, color: MUTED }}>
                {lmsDate(test.released_at)}
              </Text>
              <View style={{ width: TEST_COLUMNS.score, alignItems: 'flex-end' }}>
                {test.submitted ? (
                  <>
                    <Text style={{ fontWeight: 700, color: colorOn('tests', test.pct) }}>
                      {test.pct === null ? '—' : `${test.pct}%`}
                    </Text>
                    <Text style={{ fontSize: 6.5, color: MUTED }}>
                      {Number(test.marks ?? 0)} / {Number(test.max_marks ?? 0)}
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 7, fontWeight: 700, color: '#b91c1c' }}>
                    {test.status === 'live' ? 'Pending' : 'Not submitted'}
                  </Text>
                )}
              </View>
              <View style={{ width: TEST_COLUMNS.bar, paddingLeft: 10 }}>
                <ScoreBar
                  value={test.submitted ? test.pct : null}
                  classAvg={test.class_avg_pct}
                  color={colorOn('tests', test.pct)}
                  width={TEST_COLUMNS.bar - 10}
                />
              </View>
              <Text style={{ width: TEST_COLUMNS.classAvg, textAlign: 'right', color: MUTED }}>
                {test.class_avg_pct === null ? '—' : `${test.class_avg_pct}%`}
              </Text>
              <Text style={{ width: TEST_COLUMNS.rank, textAlign: 'right', fontSize: 7.5 }}>
                {test.rank ? `#${test.rank} of ${test.takers}` : '—'}
              </Text>
            </Row>
          ))}
        </>
      )}
    </>
  );
}

// ── Internal exams ────────────────────────────────────────────────────────────────────────

const EXAM_COLUMNS = { subject: 214, marks: 70, score: 50, bar: 130, classAvg: 52 };

/** What an exam row shows when there is no percentage: a grade, or absent. */
function examResult(exam: StudentExam) {
  if (exam.pct !== null) return null;
  if (exam.grade_text && !/^ab(sent)?$/i.test(exam.grade_text)) return exam.grade_text;
  return 'Absent';
}

function ExamsSection({ exams, average }: { exams: StudentExam[]; average: number | null }) {
  const subjectExams = exams.filter((exam) => exam.kind === 'other');
  const mocks = exams.filter((exam) => exam.kind !== 'other');
  const events = [...new Set(subjectExams.map((exam) => exam.event))];
  const color = dimensionById('exams').color;
  let index = 0;

  const examRow = (exam: StudentExam, label: string, meta: string) => {
    const result = examResult(exam);
    return (
      <Row key={exam.id} index={index++}>
        <View style={{ width: EXAM_COLUMNS.subject, paddingRight: 6 }}>
          <Text style={{ fontWeight: 600, fontSize: 8.5 }}>{label}</Text>
          <Text style={{ fontSize: 6.5, color: MUTED }}>{meta}</Text>
        </View>
        <Text
          style={{ width: EXAM_COLUMNS.marks, textAlign: 'right', fontSize: 7.5, color: MUTED }}
        >
          {exam.marks !== null && exam.max_marks !== null
            ? `${Number(exam.marks)} / ${Number(exam.max_marks)}`
            : ''}
        </Text>
        <Text
          style={{
            width: EXAM_COLUMNS.score,
            textAlign: 'right',
            fontWeight: 700,
            color: result === 'Absent' ? '#b91c1c' : result ? INK : colorOn('exams', exam.pct),
            fontSize: result === 'Absent' ? 7.5 : 9,
          }}
        >
          {result ?? `${exam.pct}%`}
        </Text>
        <View style={{ width: EXAM_COLUMNS.bar, paddingLeft: 12 }}>
          {result === null ? (
            <ScoreBar
              value={exam.pct}
              classAvg={exam.class_avg_pct}
              color={colorOn('exams', exam.pct)}
              width={EXAM_COLUMNS.bar - 12}
            />
          ) : null}
        </View>
        <Text style={{ width: EXAM_COLUMNS.classAvg, textAlign: 'right', color: MUTED }}>
          {exam.class_avg_pct === null ? '—' : `${exam.class_avg_pct}%`}
        </Text>
      </Row>
    );
  };

  return (
    <>
      <SectionTitle
        title="Internal exams"
        aside={
          average === null
            ? 'Midterms and end-term'
            : `Average ${average}% in midterms and end-term`
        }
        color={color}
      />
      {exams.length === 0 ? (
        <Empty>No internal exam marks for this student yet.</Empty>
      ) : (
        <>
          <HeadRow>
            <Text style={[head, { width: EXAM_COLUMNS.subject }]}>SUBJECT</Text>
            <Text style={[head, { width: EXAM_COLUMNS.marks, textAlign: 'right' }]}>MARKS</Text>
            <Text style={[head, { width: EXAM_COLUMNS.score, textAlign: 'right' }]}>SCORE</Text>
            <Text style={[head, { width: EXAM_COLUMNS.bar, paddingLeft: 12 }]}>VS CLASS</Text>
            <Text style={[head, { width: EXAM_COLUMNS.classAvg, textAlign: 'right' }]}>CLASS</Text>
          </HeadRow>
          {events.map((event) => (
            <View key={event}>
              <Text
                minPresenceAhead={20}
                style={{
                  fontSize: 7.5,
                  fontWeight: 700,
                  color: '#334155',
                  backgroundColor: SOFT,
                  paddingVertical: 3,
                  paddingHorizontal: 4,
                }}
              >
                {examEventLabel(event)}
              </Text>
              {subjectExams
                .filter((exam) => exam.event === event)
                .map((exam) => examRow(exam, exam.subject, lmsDate(exam.exam_date)))}
            </View>
          ))}
          {mocks.length > 0 && (
            <View>
              <Text
                minPresenceAhead={20}
                style={{
                  fontSize: 7.5,
                  fontWeight: 700,
                  color: '#334155',
                  backgroundColor: SOFT,
                  paddingVertical: 3,
                  paddingHorizontal: 4,
                }}
              >
                Mock interviews and group discussions
              </Text>
              {mocks.map((exam) =>
                examRow(
                  exam,
                  EXAM_KIND_LABELS[exam.kind] ?? exam.subject,
                  `${examEventLabel(exam.event)} · ${lmsDate(exam.exam_date)}`
                )
              )}
            </View>
          )}
        </>
      )}
    </>
  );
}

// ── AMCAT ─────────────────────────────────────────────────────────────────────────────────

/** Average of a sitting's section scores (out of 100), as the website shows it. */
function sittingAverage(sitting: AmcatSitting) {
  return mean(
    sitting.sections
      .map((section) => section.score)
      .filter((score): score is number => typeof score === 'number')
  );
}

function AmcatSection({ sittings }: { sittings: AmcatSitting[] }) {
  const ordered = [...sittings].sort((a, b) => (a.taken_at ?? '').localeCompare(b.taken_at ?? ''));
  const averages = ordered.map(sittingAverage).filter((value): value is number => value !== null);
  const change = averages.length > 1 ? averages[averages.length - 1] - averages[0] : null;
  const color = dimensionById('amcat').color;

  return (
    <>
      <SectionTitle title="AMCAT" aside="Section scores out of 100" color={color} />
      {ordered.length === 0 ? (
        <Empty>No AMCAT sittings yet.</Empty>
      ) : (
        <>
          <View
            wrap={false}
            style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch', marginBottom: 6 }}
          >
            <StatTile
              width="24%"
              label="Latest average"
              value={averages.length ? String(averages[averages.length - 1]) : '—'}
              hint={lmsDate(ordered[ordered.length - 1].taken_at)}
              color={colorOn('amcat', averages[averages.length - 1])}
            />
            <StatTile
              width="24%"
              label="Sittings"
              value={formatNumber(ordered.length)}
              hint={`first ${lmsDate(ordered[0].taken_at)}`}
              color={color}
            />
            {/* Average of every sitting, oldest first, as small columns. */}
            <View
              style={{
                flexGrow: 1,
                borderWidth: 0.75,
                borderColor: LINE,
                borderRadius: 6,
                padding: 8,
              }}
            >
              <Text style={{ fontSize: 7, fontWeight: 600, color: MUTED, letterSpacing: 0.6 }}>
                TREND, OLDEST FIRST
                {change !== null ? (
                  <Text style={{ color: change >= 0 ? '#15803d' : '#b91c1c' }}>
                    {'  '}
                    {change >= 0 ? '+' : ''}
                    {change} SINCE THE FIRST
                  </Text>
                ) : null}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 }}>
                {ordered.map((sitting) => {
                  const value = sittingAverage(sitting);
                  return (
                    <View key={sitting.id} style={{ alignItems: 'center', width: 26 }}>
                      <Text style={{ fontSize: 6.5, fontWeight: 700 }}>{value ?? '—'}</Text>
                      <View
                        style={{
                          width: 12,
                          height: Math.max(1, ((value ?? 0) / 100) * 26),
                          backgroundColor: colorOn('amcat', value),
                          borderRadius: 1.5,
                          marginTop: 1,
                        }}
                      />
                      <Text style={{ fontSize: 5.5, color: MUTED, marginTop: 1 }}>
                        {lmsDate(sitting.taken_at).replace(/^\d+ /, '')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <Text minPresenceAhead={30} style={{ fontSize: 9, fontWeight: 700, marginBottom: 2 }}>
            Sittings
            <Text style={{ fontWeight: 400, color: MUTED }}> · newest first</Text>
          </Text>
          {[...ordered].reverse().map((sitting, index) => {
            const average = sittingAverage(sitting);
            return (
              <Row key={sitting.id} index={index}>
                <View style={{ width: 150, paddingRight: 6 }}>
                  <Text style={{ fontWeight: 600, fontSize: 8 }}>{sitting.test_name}</Text>
                  <Text style={{ fontSize: 6.5, color: MUTED }}>
                    {[lmsDate(sitting.taken_at), sitting.status].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={{ width: 40, alignItems: 'flex-end', paddingRight: 8 }}>
                  <Text style={{ fontWeight: 800, fontSize: 10, color: colorOn('amcat', average) }}>
                    {average ?? '—'}
                  </Text>
                  <Text style={{ fontSize: 5.5, color: MUTED }}>average</Text>
                </View>
                <View
                  style={{
                    flexGrow: 1,
                    flexBasis: 0,
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 3,
                  }}
                >
                  {sitting.sections.map((section) => {
                    const sectionColor =
                      section.score === null ? BAND_COLORS.none : colorOn('amcat', section.score);
                    return (
                      <View
                        key={section.name}
                        style={{
                          flexDirection: 'row',
                          backgroundColor: tint(sectionColor, 0.1),
                          borderRadius: 3,
                          paddingVertical: 1.5,
                          paddingHorizontal: 4,
                        }}
                      >
                        <Text style={{ fontSize: 6.5, color: '#334155' }}>{section.name} </Text>
                        <Text style={{ fontSize: 6.5, fontWeight: 700, color: sectionColor }}>
                          {section.score === null ? 'not taken' : section.score}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Row>
            );
          })}
        </>
      )}
    </>
  );
}

// ── Attendance ────────────────────────────────────────────────────────────────────────────

function AttendanceSection({ attendance }: { attendance: StudentAssessmentsData['attendance'] }) {
  const color = dimensionById('attendance').color;
  const totals = attendance.subjects.reduce(
    (sum, subject) => ({
      sessions: sum.sessions + subject.sessions,
      present: sum.present + subject.present,
      primeSessions: sum.primeSessions + (subject.prime ? subject.sessions : 0),
      primePresent: sum.primePresent + (subject.prime ? subject.present : 0),
    }),
    { sessions: 0, present: 0, primeSessions: 0, primePresent: 0 }
  );
  const overall = totals.sessions ? percent(totals.present, totals.sessions) : null;
  const prime = totals.primeSessions ? percent(totals.primePresent, totals.primeSessions) : null;
  const recent = attendance.weeks.slice(-4);
  const recentSessions = recent.reduce((sum, week) => sum + week.sessions, 0);
  const lastWeeks = recentSessions
    ? percent(
        recent.reduce((sum, week) => sum + week.present, 0),
        recentSessions
      )
    : null;
  const low = attendance.subjects.filter((subject) => (subject.pct ?? 0) < 75).length;
  const weeks = attendance.weeks.slice(-16);

  return (
    <>
      <SectionTitle title="Attendance" aside="Classes since 1 July" color={color} />
      {attendance.subjects.length === 0 ? (
        <Empty>No attendance recorded for this student yet.</Empty>
      ) : (
        <>
          <View wrap={false} style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile
              width="24%"
              label="All classes"
              value={overall === null ? '—' : `${overall}%`}
              hint={`${formatNumber(totals.present)} of ${formatNumber(totals.sessions)} classes`}
              color={colorOn('attendance', overall)}
            />
            <StatTile
              width="24%"
              label="PRIME classes"
              value={prime === null ? '—' : `${prime}%`}
              hint={`${formatNumber(totals.primePresent)} of ${formatNumber(totals.primeSessions)} classes`}
              color={colorOn('attendance', prime)}
            />
            <StatTile
              width="24%"
              label="Last 4 weeks"
              value={lastWeeks === null ? '—' : `${lastWeeks}%`}
              hint="recent attendance"
              color={colorOn('attendance', lastWeeks)}
            />
            <StatTile
              width="24%"
              label="Subjects"
              value={formatNumber(attendance.subjects.length)}
              hint={low ? `${low} below 75%` : 'all at 75% or more'}
              color={low ? BAND_COLORS.ok : color}
            />
          </View>

          {weeks.length > 1 && (
            <View
              wrap={false}
              style={{ marginTop: 10, backgroundColor: SOFT, borderRadius: 8, padding: 10 }}
            >
              <Text style={{ fontSize: 8.5, fontWeight: 700, marginBottom: 6 }}>
                Week by week
                <Text style={{ fontWeight: 400, color: MUTED }}>
                  {' '}
                  · share of classes attended each week (week starting)
                </Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
                {weeks.map((week) => (
                  <View key={week.week} style={{ flexGrow: 1, flexBasis: 0, alignItems: 'center' }}>
                    <Text style={{ fontSize: 6, fontWeight: 700 }}>
                      {week.pct === null ? '—' : week.pct}
                    </Text>
                    <View
                      style={{
                        width: '70%',
                        height: Math.max(1, ((week.pct ?? 0) / 100) * 40),
                        backgroundColor: colorOn('attendance', week.pct),
                        borderRadius: 1.5,
                        marginTop: 1,
                      }}
                    />
                    <Text style={{ fontSize: 5.5, color: MUTED, marginTop: 2 }}>
                      {shortDate(week.week)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Text style={{ fontSize: 9, fontWeight: 700, marginTop: 10, marginBottom: 2 }}>
            By subject
          </Text>
          <HeadRow>
            <Text style={[head, { width: 230 }]}>SUBJECT</Text>
            <Text style={[head, { width: 80, textAlign: 'right' }]}>ATTENDED</Text>
            <Text style={[head, { width: 50, textAlign: 'right' }]}>SHARE</Text>
            <Text style={[head, { width: 160, paddingLeft: 12 }]} />
          </HeadRow>
          {[...attendance.subjects]
            .sort((a, b) => Number(b.prime) - Number(a.prime) || b.sessions - a.sessions)
            .map((subject, index) => (
              <Row key={subject.subject} index={index}>
                <View style={{ width: 230, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, fontWeight: 600 }}>{subject.subject}</Text>
                  {subject.prime ? (
                    <Text style={{ fontSize: 6, fontWeight: 800, color: '#d97706', marginLeft: 4 }}>
                      PRIME
                    </Text>
                  ) : null}
                </View>
                <Text style={{ width: 80, textAlign: 'right', fontSize: 7.5, color: MUTED }}>
                  {subject.present} of {subject.sessions}
                </Text>
                <Text
                  style={{
                    width: 50,
                    textAlign: 'right',
                    fontWeight: 700,
                    color: colorOn('attendance', subject.pct),
                  }}
                >
                  {subject.pct === null ? '—' : `${subject.pct}%`}
                </Text>
                <View style={{ width: 160, paddingLeft: 12 }}>
                  <ScoreBar
                    value={subject.pct}
                    classAvg={null}
                    color={colorOn('attendance', subject.pct)}
                    width={148}
                  />
                </View>
              </Row>
            ))}
        </>
      )}
    </>
  );
}
