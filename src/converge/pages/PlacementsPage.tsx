import type { PlacementsSearch } from '@/lib/placements';
import SharedPlacementsPage from '@/pages/PlacementsPage';

import { Link, useRouteSearch, useSetSearch } from '../nav';

/** The same Placements page as Vertex's, measured on PRIME domains and ELQ. */
export default function PlacementsPage() {
  const search = useRouteSearch<PlacementsSearch>();
  const setSearch = useSetSearch<PlacementsSearch>();
  return (
    <SharedPlacementsPage
      search={search}
      setSearch={setSearch}
      studentLink={(slug, children) => (
        <Link to="/s/$slug" params={{ slug }}>
          {children}
        </Link>
      )}
    />
  );
}
