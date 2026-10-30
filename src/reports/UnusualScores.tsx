// "Tests with Unusually High Scores": tests taken in an open browser whose scores are high and
// uniform enough to suggest answers were shared (src/lib/integrity.ts). A sign, not proof.

import { Page, Text, View } from '@react-pdf/renderer';

import { INTEGRITY_NOTE, type Integrity } from '@/lib/integrity';
import { INK, MUTED, ReportFooter, base, formatNumber } from '@/reports/shared';

export interface ReportFlaggedTest {
  campus: string;
  name: string;
  category: string;
  submitted: number;
  released: string | null;
  integrity: Integrity;
}

const CATEGORY: Record<string, string> = {
  test: 'Test',
  assignment: 'Practice',
  mcq: 'MCQ',
  amcat_mock: 'AMCAT mock',
};

const LEVEL = {
  high: { label: 'POSSIBLE COPYING', color: '#b91c1c', tint: '#fef2f2' },
  medium: { label: 'CHECK SCORES', color: '#b45309', tint: '#fffbeb' },
} as const;

const released = (value: string | null) =>
  value
    ? new Date(value.replace(' ', 'T').slice(0, 19)).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export function UnusualScoresPage({
  tests,
  label,
  showCampus,
}: {
  tests: ReportFlaggedTest[];
  label: string;
  showCampus: boolean;
}) {
  if (!tests.length) return null;
  const widths = { flag: 96, test: showCampus ? 210 : 290, campus: 150, type: 64, submitted: 60 };
  const head = { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.4 } as const;
  const sorted = [...tests].sort(
    (a, b) =>
      (a.integrity.level === b.integrity.level ? 0 : a.integrity.level === 'high' ? -1 : 1) ||
      (b.released ?? '').localeCompare(a.released ?? '')
  );

  return (
    <Page
      size="A4"
      orientation="landscape"
      style={[base.page, { paddingTop: 28, paddingHorizontal: 32 }]}
      wrap
    >
      <Text style={{ fontSize: 16, fontWeight: 800 }}>Tests with Unusually High Scores</Text>
      <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>
        {formatNumber(tests.length)} tests. {INTEGRITY_NOTE}
      </Text>

      <View
        fixed
        style={{
          flexDirection: 'row',
          paddingVertical: 6,
          paddingHorizontal: 4,
          marginTop: 10,
          borderBottomWidth: 1,
          borderBottomColor: INK,
        }}
      >
        <Text style={[head, { width: widths.flag }]}>FLAG</Text>
        <Text style={[head, { width: widths.test }]}>TEST</Text>
        {showCampus && <Text style={[head, { width: widths.campus }]}>CAMPUS</Text>}
        <Text style={[head, { width: widths.type }]}>TYPE</Text>
        <Text style={[head, { width: widths.submitted, textAlign: 'right', paddingRight: 8 }]}>
          SUBMITTED
        </Text>
        <Text style={[head, { flexGrow: 1, flexBasis: 0 }]}>WHY</Text>
      </View>

      {sorted.map((test, index) => {
        const level = LEVEL[test.integrity.level];
        return (
          <View
            key={`${test.campus}-${test.name}-${index}`}
            wrap={false}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              paddingVertical: 5,
              paddingHorizontal: 4,
              borderBottomWidth: 0.75,
              borderBottomColor: '#cbd5e1',
              borderBottomStyle: 'dotted',
              backgroundColor: index % 2 ? '#fbfcfe' : 'white',
            }}
          >
            <View style={{ width: widths.flag }}>
              <Text
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 6.5,
                  fontWeight: 800,
                  color: level.color,
                  backgroundColor: level.tint,
                  paddingHorizontal: 4,
                  paddingVertical: 1.5,
                  borderRadius: 3,
                }}
              >
                {level.label}
              </Text>
            </View>
            <View style={{ width: widths.test, paddingRight: 8 }}>
              <Text style={{ fontWeight: 700 }}>{test.name}</Text>
              <Text style={{ fontSize: 6.5, color: MUTED }}>
                Released {released(test.released)}
              </Text>
            </View>
            {showCampus && (
              <Text style={{ width: widths.campus, paddingRight: 8 }}>{test.campus}</Text>
            )}
            <Text style={{ width: widths.type }}>{CATEGORY[test.category] ?? test.category}</Text>
            <Text style={{ width: widths.submitted, textAlign: 'right', paddingRight: 8 }}>
              {formatNumber(test.submitted)}
            </Text>
            <Text style={{ flexGrow: 1, flexBasis: 0, fontSize: 7.5, color: '#334155' }}>
              {test.integrity.reasons.join('. ')}.
            </Text>
          </View>
        );
      })}
      <ReportFooter label={label} />
    </Page>
  );
}
