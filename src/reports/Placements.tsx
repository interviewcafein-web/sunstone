// Placements in the PDF reports: the same numbers as the Placements page (api/placements.ts),
// one page per kind of offer (full-time jobs, internships) that the report's campuses have.

import { Page, Text, View } from '@react-pdf/renderer';

import { cohortLabel } from '@/lib/cohorts';
import { formatPay, type PlacementsResponse } from '@/lib/placements';
import { INK, LINE, MUTED, NAVY, ReportFooter, SOFT, base } from '@/reports/shared';

const head = { fontSize: 6.5, fontWeight: 700, color: MUTED, letterSpacing: 0.4 } as const;

function Table({
  columns,
  rows,
}: {
  columns: { label: string; width: number; right?: boolean }[];
  rows: string[][];
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 3,
          borderBottomWidth: 1,
          borderBottomColor: INK,
        }}
      >
        {columns.map((column) => (
          <Text
            key={column.label}
            style={[head, { width: column.width, textAlign: column.right ? 'right' : 'left' }]}
          >
            {column.label.toUpperCase()}
          </Text>
        ))}
      </View>
      {rows.map((cells, index) => (
        <View
          key={index}
          wrap={false}
          style={{
            flexDirection: 'row',
            paddingVertical: 3,
            borderBottomWidth: 0.5,
            borderBottomColor: LINE,
            backgroundColor: index % 2 ? SOFT : undefined,
          }}
        >
          {cells.map((cell, column) => (
            <Text
              key={column}
              style={{
                width: columns[column].width,
                fontSize: 7.5,
                textAlign: columns[column].right ? 'right' : 'left',
                paddingRight: 4,
              }}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, borderWidth: 0.5, borderColor: LINE, borderRadius: 6, padding: 7 }}>
      <Text style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>{value}</Text>
      <Text style={{ fontSize: 7, color: MUTED, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

export function PlacementsPages({
  reports,
  label,
  allCampuses,
}: {
  reports: PlacementsResponse[];
  label: string;
  allCampuses: boolean;
}) {
  return (
    <>
      {reports
        .filter((report) => report.totals.offers > 0)
        .map((report) => {
          const fullTime = report.kind === 'full-time';
          const pay = (value: number | null) => formatPay(value, fullTime);
          const { totals } = report;
          const measure = Object.fromEntries(report.measures.map((m) => [m.key, m]));
          const show = (key: string, value: number | null) =>
            value == null ? '—' : `${Number(value.toFixed(1))}${measure[key]?.unit ?? ''}`;
          return (
            <Page
              key={report.kind}
              size="A4"
              orientation="landscape"
              style={[base.page, { paddingTop: 28, paddingHorizontal: 32 }]}
              wrap
            >
              <Text style={{ fontSize: 16, fontWeight: 800 }}>
                Placements: {fullTime ? 'Full-Time Jobs' : 'Internships'}
              </Text>
              <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>
                {fullTime ? 'Job offers' : 'Internships'} from the LMS for{' '}
                {report.batches.map((b) => cohortLabel(b.program, b.year)).join(', ')}, set against how
                each student prepared.
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                <Figure
                  label="Students in season"
                  value={totals.students.toLocaleString('en-IN')}
                />
                <Figure
                  label={fullTime ? 'Placed' : 'With an internship'}
                  value={`${totals.placed} (${totals.rate ?? 0}%)`}
                />
                <Figure label="Offers" value={String(totals.offers)} />
                <Figure
                  label={fullTime ? 'Median CTC' : 'Median stipend'}
                  value={pay(totals.medianPay)}
                />
                <Figure
                  label={fullTime ? 'Highest CTC' : 'Highest stipend'}
                  value={pay(totals.highestPay)}
                />
                <Figure label="Joined / awaited" value={`${totals.joined} / ${totals.awaiting}`} />
              </View>

              <View style={{ flexDirection: 'row', gap: 18, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={base.sectionTitle}>Does Preparation Pay Off?</Text>
                  <Table
                    columns={[
                      { label: 'Measure', width: 110 },
                      { label: fullTime ? 'Placed' : 'Interning', width: 60, right: true },
                      { label: 'Waiting', width: 60, right: true },
                      { label: 'Top quarter', width: 60, right: true },
                      { label: 'Bottom quarter', width: 70, right: true },
                    ]}
                    rows={report.prep
                      .filter((row) => row.placedAvg != null || row.othersAvg != null)
                      .map((row) => [
                        measure[row.key]?.label ?? row.key,
                        show(row.key, row.placedAvg),
                        show(row.key, row.othersAvg),
                        row.bands.length === 4 ? `${row.bands[3].rate ?? 0}%` : '—',
                        row.bands.length === 4 ? `${row.bands[0].rate ?? 0}%` : '—',
                      ])}
                  />
                  <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 3 }}>
                    Quarters: the offer rate among the best- and least-prepared quarter of the batch
                    on each measure.
                  </Text>

                  <Text style={[base.sectionTitle, { marginTop: 12 }]}>Top Companies</Text>
                  <Table
                    columns={[
                      { label: 'Company', width: 220 },
                      { label: 'Offers', width: 60, right: true },
                      { label: 'Median', width: 80, right: true },
                    ]}
                    rows={report.companies
                      .slice(0, 8)
                      .map((row) => [row.company, String(row.offers), pay(row.medianPay)])}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  {allCampuses ? (
                    <>
                      <Text style={base.sectionTitle}>By Campus</Text>
                      <Table
                        columns={[
                          { label: 'Campus', width: 200 },
                          { label: 'Placed', width: 60, right: true },
                          { label: 'Rate', width: 50, right: true },
                          { label: 'Median', width: 70, right: true },
                        ]}
                        rows={report.byCampus
                          .slice(0, 14)
                          .map((row) => [
                            row.name,
                            `${row.placed}/${row.students}`,
                            `${row.rate ?? 0}%`,
                            pay(row.medianPay),
                          ])}
                      />
                    </>
                  ) : null}
                  <Text style={[base.sectionTitle, { marginTop: allCampuses ? 12 : 0 }]}>
                    Ready, No {fullTime ? 'Offer' : 'Internship'} Yet
                  </Text>
                  <Table
                    columns={[
                      { label: 'Student', width: 170 },
                      { label: 'Campus', width: 130 },
                      { label: 'Readiness', width: 60, right: true },
                    ]}
                    rows={report.ready
                      .slice(0, 10)
                      .map((row) => [row.name, row.campus, String(row.readiness ?? '—')])}
                  />
                </View>
              </View>
              <ReportFooter label={label} />
            </Page>
          );
        })}
    </>
  );
}
