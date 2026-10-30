// Campus issues: the fixed categories campus staff choose from, and the shapes /api/issues
// sends. Shared by the website, the API and (copied) the Vertex app.

export interface IssueCategory {
  id: string;
  label: string;
  group: IssueGroup;
}

export type IssueGroup = 'infrastructure' | 'trainer' | 'classes' | 'lms' | 'students' | 'other';

export const ISSUE_GROUPS: { id: IssueGroup; label: string }[] = [
  { id: 'infrastructure', label: 'Classroom and Lab' },
  { id: 'trainer', label: 'Trainer' },
  { id: 'classes', label: 'Classes and Schedule' },
  { id: 'lms', label: 'LMS and Tests' },
  { id: 'students', label: 'Students' },
  { id: 'other', label: 'Other' },
];

export const ISSUE_CATEGORIES: IssueCategory[] = [
  { id: 'fan_ac', label: 'Fan or AC Not Working', group: 'infrastructure' },
  { id: 'projector', label: 'Projector or Display', group: 'infrastructure' },
  { id: 'power', label: 'Power or Electricity', group: 'infrastructure' },
  { id: 'lab_computers', label: 'Lab Computers', group: 'infrastructure' },
  { id: 'internet', label: 'Internet or Wi-Fi', group: 'infrastructure' },
  { id: 'room', label: 'Classroom or Furniture', group: 'infrastructure' },
  { id: 'trainer_not_deployed', label: 'Trainer Not Deployed', group: 'trainer' },
  { id: 'trainer_absent', label: 'Trainer Absent or Late', group: 'trainer' },
  { id: 'trainer_change', label: 'Trainer Change Needed', group: 'trainer' },
  { id: 'class_not_scheduled', label: 'Class Not Scheduled', group: 'classes' },
  { id: 'timetable_clash', label: 'Timetable Clash', group: 'classes' },
  { id: 'room_unavailable', label: 'Room Not Available', group: 'classes' },
  { id: 'lms_access', label: 'LMS Access Problem', group: 'lms' },
  { id: 'test_problem', label: 'Test or Assessment Problem', group: 'lms' },
  { id: 'content_missing', label: 'Content Missing', group: 'lms' },
  { id: 'attendance', label: 'Low Attendance', group: 'students' },
  { id: 'student_concern', label: 'Student Concern', group: 'students' },
  { id: 'other', label: 'Something Else', group: 'other' },
];

export const categoryLabel = (id: string) =>
  ISSUE_CATEGORIES.find((category) => category.id === id)?.label ?? 'Something Else';

export const categoryGroup = (id: string): IssueGroup =>
  ISSUE_CATEGORIES.find((category) => category.id === id)?.group ?? 'other';

export type IssuePriority = 'normal' | 'high' | 'urgent';
export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export const PRIORITIES: { id: IssuePriority; label: string; color: string }[] = [
  { id: 'normal', label: 'Normal', color: '#475569' },
  { id: 'high', label: 'High', color: '#d97706' },
  { id: 'urgent', label: 'Urgent', color: '#dc2626' },
];

export const STATUSES: { id: IssueStatus; label: string; color: string }[] = [
  { id: 'open', label: 'Open', color: '#dc2626' },
  { id: 'in_progress', label: 'In Progress', color: '#d97706' },
  { id: 'resolved', label: 'Resolved', color: '#059669' },
];

export const priorityOf = (id: string) => PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[0];
export const statusOf = (id: string) => STATUSES.find((s) => s.id === id) ?? STATUSES[0];

export interface Person {
  email: string;
  name: string | null;
}

export interface Issue {
  id: number;
  campusId: number;
  campus: string;
  category: string;
  priority: IssuePriority;
  location: string | null;
  details: string;
  status: IssueStatus;
  raisedBy: Person;
  assignedTo: Person;
  /** Milliseconds since 1970. */
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  /** Replies, not counting status or assignee changes. */
  replies: number;
}

export interface IssueUpdate {
  id: number;
  author: Person;
  kind: 'comment' | 'status' | 'assign';
  body: string | null;
  status: IssueStatus | null;
  assignee: Person | null;
  at: number;
}

export interface IssuesResponse {
  issues: Issue[];
  /** Open or in progress, among the issues the viewer can see. */
  openCount: number;
  /** Campuses the viewer may raise an issue for. */
  campuses: { id: number; name: string }[];
  /** HQ members an issue can be assigned to (HQ and super admins only). */
  team: Person[];
  /** Whether the viewer can change status and assignee on any issue. */
  manages: boolean;
  me: string;
}

export interface IssueDetail {
  issue: Issue;
  updates: IssueUpdate[];
}

/** "3 h ago", "2 d ago": how long an issue has been waiting. */
export function ago(ms: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - ms) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
