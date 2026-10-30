// PRIME coding delivery in the PDF reports, as on the campus page's Syllabus vs Delivery: hours
// from the delivery tracker (allocated, verified, awaiting verification, still to go), by batch
// and section and by trainer, classes not logged yet, and the PRIME coding instructors.

import { Page, Text, View } from '@react-pdf/renderer';

import { lmsDate, type ReportCampusDelivery } from '@/lib/assessments';
import { cohortLabel } from '@/lib/cohorts';
import { INK, LINE, MUTED, ReportFooter, StatTile, base, formatNumber } from '@/reports/shared';

const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
/** Verified against allocated: green from 75%, amber from 40%. */
const paceColor = (pct: number) => (pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444');
const PENDING = '#f59e0b';

const head = { fontSize: 6.5, fontWeight: 700, color: MUTED, letterSpacing: 0.4 } as const;
const rowStyle = (index: number) =>
  ({
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3.5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    backgroundColor: index % 2 ? '#fbfcfe' : 'white',
  }) as const;

/** Verified (and awaiting, lighter) as one bar. */
function SplitBar({
  verified,
  pending,
  width,
  height = 5,
}: {
  verified: number;
  pending: number;
  width: number;
  height?: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        width,
        height,
        backgroundColor: '#eef2f6',
        borderRadius: height,
      }}
    >
      <View
        style={{
          width: (Math.min(100, verified) / 100) * width,
          height,
          backgroundColor: paceColor(verified),
          borderRadius: height,
        }}
      />
      <View
        style={{
          width: (Math.min(100 - Math.min(100, verified), pending) / 100) * width,
          height,
          backgroundColor: PENDING,
          opacity: 0.55,
        }}
      />
    </View>
  );
}

function SectionTitle({ children, note }: { children: string; note?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        marginTop: 14,
        marginBottom: 4,
      }}
    >
      <Text style={{ fontSize: 10.5, fontWeight: 800 }}>{children}</Text>
      {note ? <Text style={{ fontSize: 7, color: MUTED }}>{note}</Text> : null}
    </View>
  );
}

/** One campus's PRIME coding delivery: a landscape page that runs on if it is long. */
export function DeliveryPage({ entry, label }: { entry: ReportCampusDelivery; label: string }) {
  const { delivery: data, instructors } = entry;
  if (!data && !instructors.length) return null;
  return (
    <Page
      size="A4"
      orientation="landscape"
      style={[base.page, { paddingTop: 28, paddingHorizontal: 32 }]}
      wrap
    >
      <Text style={{ fontSize: 16, fontWeight: 800 }}>PRIME Coding Delivery · {entry.campus}</Text>
      <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>
        Hours from the delivery tracker: allocated, verified, awaiting verification and still to go.
        {data?.syncedAt ? ` Updated ${lmsDate(data.syncedAt, true)}.` : ''}
      </Text>

      {data ? (
        <DeliveryBody data={data} />
      ) : (
        <Text style={{ fontSize: 9, color: MUTED, marginTop: 12 }}>
          No PRIME coding classes recorded in the tracker for this selection yet.
        </Text>
      )}

      {instructors.length > 0 && (
        <View wrap={false}>
          <SectionTitle note="attendance in their PRIME coding classes, from the LMS">
            PRIME Coding Instructors
          </SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {instructors.map((person) => (
              <View
                key={person.name}
                style={{
                  width: 175,
                  borderWidth: 0.75,
                  borderColor: LINE,
                  borderRadius: 5,
                  paddingVertical: 5,
                  paddingHorizontal: 7,
                }}
              >
                <Text style={{ fontSize: 8, fontWeight: 700 }}>{person.name}</Text>
                <Text style={{ fontSize: 7, color: MUTED, marginTop: 1 }}>
                  {formatNumber(person.classes)} classes ·{' '}
                  {person.attendance === null ? '—' : `${person.attendance}%`} attendance
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <ReportFooter label={label} />
    </Page>
  );
}

function DeliveryBody({ data }: { data: NonNullable<ReportCampusDelivery['delivery']> }) {
  const done = share(data.delivered, data.allocated);
  const pending = share(data.pending, data.allocated);
  const remaining = Math.max(0, data.allocated - data.delivered - data.pending);
  const notes = [
    data.rejected > 0 && `Rejected Entries: ${formatNumber(data.rejected)}`,
    data.invalid > 0 && `Left Out (Impossible Duration): ${formatNumber(data.invalid)}`,
    data.duplicates > 0 && `Repeat Submissions Counted Once: ${formatNumber(data.duplicates)}`,
  ].filter(Boolean);
  const widths = { section: 230, hours: 110, bar: 170 };
  const t = { name: 190, hours: 80, pending: 80, classes: 60, problems: 70, attendance: 70 };

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <StatTile
          width="18%"
          label="Allocated"
          value={`${formatNumber(data.allocated)} h`}
          hint="agreed hours, all sections"
          color={INK}
        />
        <StatTile
          width="18%"
          label="Verified"
          value={`${formatNumber(data.delivered)} h`}
          hint={`${done}% of allocated`}
          color={paceColor(done)}
        />
        <StatTile
          width="18%"
          label="Awaiting Verification"
          value={`${formatNumber(data.pending)} h`}
          hint={`${pending}% of allocated`}
          color={PENDING}
        />
        <StatTile
          width="18%"
          label="Still to Go"
          value={`${formatNumber(remaining)} h`}
          hint={`${share(remaining, data.allocated)}% of allocated`}
          color="#94a3b8"
        />
        <StatTile
          width="24%"
          label="Classes · Problems · Attendance"
          value={`${formatNumber(data.classes)} · ${formatNumber(data.problems)} · ${data.attendance === null ? '—' : `${data.attendance}%`}`}
          hint={`last class ${lmsDate(data.last_class)}`}
        />
      </View>
      <View style={{ marginTop: 8 }}>
        <SplitBar verified={done} pending={pending} width={778} height={6} />
        {notes.length > 0 && (
          <Text style={{ fontSize: 7, color: MUTED, marginTop: 3 }}>{notes.join(' · ')}</Text>
        )}
      </View>

      <SectionTitle note="verified of allocated hours, awaiting verification in amber">
        By Batch and Section
      </SectionTitle>
      <View
        fixed={false}
        style={{
          flexDirection: 'row',
          paddingVertical: 4,
          paddingHorizontal: 4,
          borderBottomWidth: 1,
          borderBottomColor: INK,
        }}
      >
        <Text style={[head, { width: widths.section }]}>BATCH · SECTION</Text>
        <Text style={[head, { width: widths.hours, textAlign: 'right', paddingRight: 10 }]}>
          VERIFIED / ALLOCATED
        </Text>
        <Text style={[head, { width: 50, textAlign: 'right', paddingRight: 10 }]}>DONE</Text>
        <Text style={[head, { width: 70, textAlign: 'right', paddingRight: 10 }]}>AWAITING</Text>
        <Text style={[head, { width: widths.bar }]}>PROGRESS</Text>
      </View>
      {data.sections.map((row, index) => {
        const pct = share(row.delivered, row.allocated);
        return (
          <View
            key={`${row.program}-${row.batch_year}-${row.section}`}
            wrap={false}
            style={rowStyle(index)}
          >
            <Text style={{ width: widths.section, fontWeight: 700 }}>
              {cohortLabel(row.program, row.batch_year)}
              <Text style={{ fontWeight: 400, color: MUTED }}>
                {row.section ? ` · Section ${row.section}` : ''}
              </Text>
            </Text>
            <Text style={{ width: widths.hours, textAlign: 'right', paddingRight: 10 }}>
              {formatNumber(row.delivered)} / {formatNumber(row.allocated)} h
            </Text>
            <Text
              style={{
                width: 50,
                textAlign: 'right',
                paddingRight: 10,
                fontWeight: 700,
                color: paceColor(pct),
              }}
            >
              {row.allocated ? `${pct}%` : '—'}
            </Text>
            <Text style={{ width: 70, textAlign: 'right', paddingRight: 10, color: MUTED }}>
              {row.pending ? `${formatNumber(row.pending)} h` : '—'}
            </Text>
            <SplitBar
              verified={pct}
              pending={share(row.pending, row.allocated)}
              width={widths.bar}
            />
          </View>
        );
      })}

      {data.trainers.length > 0 && (
        <View wrap={false}>
          <SectionTitle note="as logged in the tracker">By Trainer</SectionTitle>
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: 4,
              paddingHorizontal: 4,
              borderBottomWidth: 1,
              borderBottomColor: INK,
            }}
          >
            <Text style={[head, { width: t.name }]}>TRAINER</Text>
            <Text style={[head, { width: t.hours, textAlign: 'right', paddingRight: 10 }]}>
              VERIFIED
            </Text>
            <Text style={[head, { width: t.pending, textAlign: 'right', paddingRight: 10 }]}>
              AWAITING
            </Text>
            <Text style={[head, { width: t.classes, textAlign: 'right', paddingRight: 10 }]}>
              CLASSES
            </Text>
            <Text style={[head, { width: t.problems, textAlign: 'right', paddingRight: 10 }]}>
              PROBLEMS
            </Text>
            <Text style={[head, { width: t.attendance, textAlign: 'right', paddingRight: 10 }]}>
              ATTENDANCE
            </Text>
            <Text style={[head, { flexGrow: 1, flexBasis: 0 }]}>LAST LOGGED · REJECTED</Text>
          </View>
          {data.trainers.map((trainer, index) => (
            <View key={trainer.name} style={rowStyle(index)}>
              <Text style={{ width: t.name, fontWeight: 700 }}>{trainer.name}</Text>
              <Text
                style={{ width: t.hours, textAlign: 'right', paddingRight: 10, fontWeight: 700 }}
              >
                {formatNumber(trainer.hours)} h
              </Text>
              <Text
                style={{
                  width: t.pending,
                  textAlign: 'right',
                  paddingRight: 10,
                  color: trainer.pending_hours ? '#b45309' : MUTED,
                }}
              >
                {trainer.pending_hours ? `${formatNumber(trainer.pending_hours)} h` : '—'}
              </Text>
              <Text style={{ width: t.classes, textAlign: 'right', paddingRight: 10 }}>
                {formatNumber(trainer.classes)}
              </Text>
              <Text style={{ width: t.problems, textAlign: 'right', paddingRight: 10 }}>
                {formatNumber(trainer.problems)}
              </Text>
              <Text style={{ width: t.attendance, textAlign: 'right', paddingRight: 10 }}>
                {trainer.attendance === null ? '—' : `${trainer.attendance}%`}
              </Text>
              <Text style={{ flexGrow: 1, flexBasis: 0, color: MUTED }}>
                {lmsDate(trainer.last_logged)}
                {trainer.rejected ? (
                  <Text style={{ color: '#b91c1c' }}>{` · Rejected: ${trainer.rejected}`}</Text>
                ) : (
                  ''
                )}
              </Text>
            </View>
          ))}
        </View>
      )}

      {data.unlogged && data.unlogged.classes > 0 && (
        <View
          wrap={false}
          style={{
            marginTop: 12,
            borderWidth: 0.75,
            borderColor: '#fcd34d',
            backgroundColor: '#fffbeb',
            borderRadius: 6,
            padding: 8,
          }}
        >
          <Text style={{ fontSize: 9.5, fontWeight: 800, color: '#92400e' }}>
            Classes Not Logged Yet: {formatNumber(data.unlogged.classes)}
          </Text>
          <Text style={{ fontSize: 7.5, color: '#475569', marginTop: 2 }}>
            Of {formatNumber(data.unlogged.checked)} PRIME coding classes in the LMS time table (
            {lmsDate(data.unlogged.from)} – {lmsDate(data.unlogged.to)}), these were on days the
            trainer logged nothing in the tracker:{' '}
            {data.unlogged.trainers
              .map(
                (trainer) => `${trainer.name} ${trainer.classes} (latest ${lmsDate(trainer.last)})`
              )
              .join(', ')}
            .
          </Text>
        </View>
      )}
    </>
  );
}

/** Every campus's PRIME coding delivery side by side, furthest behind first. */
export function DeliveryComparisonPage({
  entries,
  label,
}: {
  entries: ReportCampusDelivery[];
  label: string;
}) {
  const rows = entries
    .filter((entry) => entry.delivery)
    .map((entry) => {
      const data = entry.delivery!;
      return {
        campus: entry.campus,
        data,
        done: share(data.delivered, data.allocated),
        remaining: Math.max(0, data.allocated - data.delivered - data.pending),
      };
    })
    .sort((a, b) => a.done - b.done);
  if (!rows.length) return null;
  const totals = rows.reduce(
    (sum, row) => ({
      allocated: sum.allocated + row.data.allocated,
      delivered: sum.delivered + row.data.delivered,
      pending: sum.pending + row.data.pending,
    }),
    { allocated: 0, delivered: 0, pending: 0 }
  );
  const w = { campus: 210, n: 72, pct: 46, bar: 120 };
  return (
    <Page
      size="A4"
      orientation="landscape"
      style={[base.page, { paddingTop: 28, paddingHorizontal: 32 }]}
      wrap
    >
      <Text style={{ fontSize: 16, fontWeight: 800 }}>PRIME Coding Delivery by Campus</Text>
      <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>
        From the delivery tracker, furthest behind first. All campuses together:{' '}
        {formatNumber(totals.delivered)} of {formatNumber(totals.allocated)} h verified (
        {share(totals.delivered, totals.allocated)}%), {formatNumber(totals.pending)} h awaiting
        verification.
      </Text>
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 4,
          paddingHorizontal: 4,
          marginTop: 12,
          borderBottomWidth: 1,
          borderBottomColor: INK,
        }}
      >
        <Text style={[head, { width: w.campus }]}>CAMPUS</Text>
        <Text style={[head, { width: w.n, textAlign: 'right', paddingRight: 10 }]}>ALLOCATED</Text>
        <Text style={[head, { width: w.n, textAlign: 'right', paddingRight: 10 }]}>VERIFIED</Text>
        <Text style={[head, { width: w.pct, textAlign: 'right', paddingRight: 10 }]}>DONE</Text>
        <Text style={[head, { width: w.n, textAlign: 'right', paddingRight: 10 }]}>AWAITING</Text>
        <Text style={[head, { width: w.n, textAlign: 'right', paddingRight: 10 }]}>
          STILL TO GO
        </Text>
        <Text style={[head, { width: w.n, textAlign: 'right', paddingRight: 10 }]}>NOT LOGGED</Text>
        <Text style={[head, { flexGrow: 1, flexBasis: 0 }]}>PROGRESS</Text>
      </View>
      {rows.map((row, index) => (
        <View key={row.campus} wrap={false} style={rowStyle(index)}>
          <Text style={{ width: w.campus, fontWeight: 700 }}>{row.campus}</Text>
          <Text style={{ width: w.n, textAlign: 'right', paddingRight: 10 }}>
            {formatNumber(row.data.allocated)} h
          </Text>
          <Text style={{ width: w.n, textAlign: 'right', paddingRight: 10, fontWeight: 700 }}>
            {formatNumber(row.data.delivered)} h
          </Text>
          <Text
            style={{
              width: w.pct,
              textAlign: 'right',
              paddingRight: 10,
              fontWeight: 700,
              color: paceColor(row.done),
            }}
          >
            {row.done}%
          </Text>
          <Text style={{ width: w.n, textAlign: 'right', paddingRight: 10, color: MUTED }}>
            {formatNumber(row.data.pending)} h
          </Text>
          <Text style={{ width: w.n, textAlign: 'right', paddingRight: 10 }}>
            {formatNumber(row.remaining)} h
          </Text>
          <Text
            style={{
              width: w.n,
              textAlign: 'right',
              paddingRight: 10,
              color: row.data.unlogged?.classes ? '#b45309' : MUTED,
            }}
          >
            {row.data.unlogged?.classes
              ? `${formatNumber(row.data.unlogged.classes)} class${row.data.unlogged.classes === 1 ? '' : 'es'}`
              : '—'}
          </Text>
          <View style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center' }}>
            <SplitBar
              verified={row.done}
              pending={share(row.data.pending, row.data.allocated)}
              width={w.bar}
            />
          </View>
        </View>
      ))}
      <ReportFooter label={label} />
    </Page>
  );
}
