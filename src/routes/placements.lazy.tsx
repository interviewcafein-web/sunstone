import { Link, createLazyFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import PlacementsPage from '@/pages/PlacementsPage';

export const Route = createLazyFileRoute('/placements')({
  component: VertexPlacements,
});

function VertexPlacements() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequireLogin>
      <PlacementsPage
        search={search}
        setSearch={(patch) =>
          navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true })
        }
        studentLink={(slug, children) => (
          <Link to="/s/$slug" params={{ slug }}>
            {children}
          </Link>
        )}
      />
    </RequireLogin>
  );
}
