import { createFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import { validateIssuesSearch, type IssuesSearch } from '@/lib/issuesSearch';
import IssuesPage from '@/pages/IssuesPage';

export type { IssuesSearch };

export const Route = createFileRoute('/issues')({
  validateSearch: validateIssuesSearch,
  component: VertexIssues,
});

function VertexIssues() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequireLogin>
      <IssuesPage
        search={search}
        setSearch={(patch) =>
          navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true })
        }
      />
    </RequireLogin>
  );
}
