import { createFileRoute } from '@tanstack/react-router';

import { validateCodingSearch } from '@/lib/codingDomain';

// The page itself is in prime.lazy.tsx, downloaded only when someone opens it.
export const Route = createFileRoute('/prime')({
  validateSearch: validateCodingSearch,
});
