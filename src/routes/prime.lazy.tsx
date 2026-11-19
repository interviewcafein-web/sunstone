import { Link, createLazyFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import CodingDomainPage from '@/pages/CodingDomainPage';

export const Route = createLazyFileRoute('/prime')({
  component: VertexPrime,
});

function VertexPrime() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RequireLogin>
      <CodingDomainPage
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
