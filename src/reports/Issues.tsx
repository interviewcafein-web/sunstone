// Campus issues still open, in the PDF reports: the same list as the Issues page and the
// weekly email, so a report shows what is waiting on the central team.

import { Page, Text, View } from '@react-pdf/renderer';

import { ago, categoryLabel, priorityOf, statusOf, type Issue } from '@/lib/issues';
import { INK, LINE, MUTED, ReportFooter, base } from '@/reports/shared';

const head = { fontSize: 6.5, fontWeight: 700, color: MUTED, letterSpacing: 0.4 } as const;

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <Text
      style={{
        fontSize: 7,
        fontWeight: 700,
        color,
        backgroundColor: `${color}1f`,
        borderRadius: 6,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
      }}
    >
      {label}
    </Text>
  );
}

/** Open campus issues, most urgent first; nothing when there are none. */
export function OpenIssuesPage({
  issues,
  label,
  showCampus,
}: {
  issues: Issue[];
  label: string;
  showCampus: boolean;
}) {
  if (!issues.length) return null;
  const w = { issue: showCampus ? 300 : 380, who: 150, tag: 70, age: 60 };
  return (
    <Page
      size="A4"
      orientation="landscape"
      style={[base.page, { paddingTop: 28, paddingHorizontal: 32 }]}
      wrap
    >
      <Text style={{ fontSize: 16, fontWeight: 800 }}>Open Campus Issues</Text>
      <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>
        Raised by campus staff and waiting on the central team: {issues.length} open, most urgent
        first. Each stays in the reports until it is resolved.
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
        <Text style={[head, { width: w.issue }]}>ISSUE</Text>
        <Text style={[head, { width: w.who }]}>RAISED BY · ASSIGNED TO</Text>
        <Text style={[head, { width: w.tag }]}>PRIORITY</Text>
        <Text style={[head, { width: w.tag }]}>STATUS</Text>
        <Text style={[head, { width: w.age, textAlign: 'right' }]}>RAISED</Text>
      </View>
      {issues.map((issue, index) => (
        <View
          key={issue.id}
          wrap={false}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingVertical: 5,
            paddingHorizontal: 4,
            borderBottomWidth: 0.5,
            borderBottomColor: LINE,
            backgroundColor: index % 2 ? '#fbfcfe' : 'white',
          }}
        >
          <View style={{ width: w.issue, paddingRight: 10 }}>
            <Text style={{ fontWeight: 700 }}>{categoryLabel(issue.category)}</Text>
            <Text style={{ fontSize: 7, color: MUTED, marginTop: 1 }}>
              {[showCampus ? issue.campus : '', issue.location ?? ''].filter(Boolean).join(' · ')}
            </Text>
            <Text style={{ fontSize: 7.5, marginTop: 2 }}>
              {issue.details.length > 180 ? `${issue.details.slice(0, 177)}…` : issue.details}
            </Text>
          </View>
          <View style={{ width: w.who, paddingRight: 8 }}>
            <Text>{issue.raisedBy.name ?? issue.raisedBy.email}</Text>
            <Text style={{ fontSize: 7, color: MUTED }}>
              {issue.assignedTo.name ?? issue.assignedTo.email}
            </Text>
          </View>
          <View style={{ width: w.tag, flexDirection: 'row' }}>
            <Tag
              label={priorityOf(issue.priority).label}
              color={priorityOf(issue.priority).color}
            />
          </View>
          <View style={{ width: w.tag, flexDirection: 'row' }}>
            <Tag label={statusOf(issue.status).label} color={statusOf(issue.status).color} />
          </View>
          <Text style={{ width: w.age, textAlign: 'right', color: MUTED }}>
            {ago(issue.createdAt)}
          </Text>
        </View>
      ))}
      <ReportFooter label={label} />
    </Page>
  );
}
