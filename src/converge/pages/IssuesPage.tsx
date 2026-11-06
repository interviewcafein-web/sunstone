// Campus issues on Converge: the same page as Vertex's (src/pages/IssuesPage.tsx), on
// Converge's route and data (the shared /api/issues answers from Converge's database here).

import SharedIssuesPage from '@/pages/IssuesPage';

import { issuesRoute } from '../routes';

export default function IssuesPage() {
  const search = issuesRoute.useSearch();
  const navigate = issuesRoute.useNavigate();
  return (
    <SharedIssuesPage
      search={search}
      setSearch={(patch) =>
        void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true })
      }
    />
  );
}
