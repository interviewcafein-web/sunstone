import { createFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import IssuesPage from '@/pages/IssuesPage';

export interface IssuesSearch {
  /** The open issue (also the link in issue emails: /issues?id=12). */
  id?: number;
  status?: 'resolved' | 'all';
  campus?: number;
  /** The Raise an Issue form is open. */
  raise?: boolean;
}

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const Route = createFileRoute('/issues')({
  validateSearch: (search: Record<string, unknown>): IssuesSearch => ({
    id: number(search.id),
    status: search.status === 'resolved' || search.status === 'all' ? search.status : undefined,
    campus: number(search.campus),
    raise: search.raise === true || search.raise === 'true' ? true : undefined,
  }),
  component: () => (
    <RequireLogin>
      <IssuesPage />
    </RequireLogin>
  ),
});
