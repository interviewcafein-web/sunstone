import { createFileRoute } from '@tanstack/react-router';

import { validatePlacementsSearch } from '@/lib/placements';

// The page itself is in placements.lazy.tsx, downloaded only when someone opens it.
export const Route = createFileRoute('/placements')({
  validateSearch: validatePlacementsSearch,
});
