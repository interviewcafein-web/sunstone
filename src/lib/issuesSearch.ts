// The Issues page's address settings (?id=12&status=resolved&campus=9&raise=true&mine=true),
// shared by Vertex's route (src/routes/issues.tsx) and Converge's (src/converge/routes.ts).

export interface IssuesSearch {
  /** The open issue (also the link in issue emails: /issues?id=12). */
  id?: number;
  status?: 'resolved' | 'all';
  campus?: number;
  /** The Raise an Issue form is open. */
  raise?: boolean;
  /** Only the issues assigned to the viewer. */
  mine?: boolean;
}

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const validateIssuesSearch = (search: Record<string, unknown>): IssuesSearch => ({
  id: number(search.id),
  status: search.status === 'resolved' || search.status === 'all' ? search.status : undefined,
  campus: number(search.campus),
  raise: search.raise === true || search.raise === 'true' ? true : undefined,
  mine: search.mine === true || search.mine === 'true' ? true : undefined,
});
