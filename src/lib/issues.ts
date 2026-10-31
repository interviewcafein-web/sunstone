// Campus issues: the fixed categories campus staff choose from, and the shapes /api/issues
// sends. Shared by the website, the API and (copied) the Vertex app.

export type IssueCategoryId =
  | 'internet'
  | 'display'
  | 'cooling'
  | 'power'
  | 'tech'
  | 'room'
  | 'trainer'
  | 'classes'
  | 'lms'
  | 'students'
  | 'other';

export interface IssueCategory {
  id: IssueCategoryId;
  label: string;
}

/** A short, common list, so picking one takes a second; anything else is Other. */
export const ISSUE_CATEGORIES: IssueCategory[] = [
  { id: 'internet', label: 'Wi-Fi and Internet' },
  { id: 'display', label: 'Projector, TV or Screen' },
  { id: 'cooling', label: 'AC or Fan' },
  { id: 'power', label: 'Power and Electricity' },
  { id: 'tech', label: 'Computers and Tech' },
  { id: 'room', label: 'Classroom and Furniture' },
  { id: 'trainer', label: 'Trainer' },
  { id: 'classes', label: 'Classes and Schedule' },
  { id: 'lms', label: 'LMS and Tests' },
  { id: 'students', label: 'Students' },
  { id: 'other', label: 'Other' },
];

/** The category's id, or 'other' for one no longer on the list. */
export const categoryOf = (id: string): IssueCategoryId =>
  ISSUE_CATEGORIES.find((category) => category.id === id)?.id ?? 'other';

export const categoryLabel = (id: string) =>
  ISSUE_CATEGORIES.find((category) => category.id === id)?.label ?? 'Other';

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

/** Someone an issue can be assigned to. */
export interface TeamMember extends Person {
  role: 'super_admin' | 'hq' | 'campus';
  /** Their campuses' names, for campus staff. */
  campus: string | null;
}

/** A photo on an issue or a reply, stored on Cloudinary. */
export interface IssueImage {
  url: string;
  width: number | null;
  height: number | null;
}

/** At most this many photos when raising an issue or in one reply. */
export const MAX_ISSUE_IMAGES = 4;
/** Largest photo accepted, in bytes. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * A Cloudinary photo at a given width, in a light modern format: the original stays as it
 * was uploaded, this asks Cloudinary for a resized copy.
 */
export const imageAt = (url: string, width: number) =>
  url.replace('/image/upload/', `/image/upload/c_limit,w_${width},f_auto,q_auto/`);

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
  /** Photos added when it was raised. */
  images: IssueImage[];
}

export interface IssueUpdate {
  id: number;
  author: Person;
  kind: 'comment' | 'status' | 'assign';
  body: string | null;
  status: IssueStatus | null;
  assignee: Person | null;
  at: number;
  images: IssueImage[];
}

export interface IssuesResponse {
  issues: Issue[];
  /** Open or in progress, among the issues the viewer can see. */
  openCount: number;
  /** Open or in progress and assigned to the viewer. */
  mineCount: number;
  /** Campuses the viewer may raise an issue for. */
  campuses: { id: number; name: string }[];
  /** Who an issue can be assigned to: everyone for HQ; HQ and their campuses' staff otherwise. */
  team: TeamMember[];
  /** Whether the viewer can change status and assignee on any issue (HQ and super admins). */
  manages: boolean;
  /** Whether photos can be added (Cloudinary is set up). */
  uploads: boolean;
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
