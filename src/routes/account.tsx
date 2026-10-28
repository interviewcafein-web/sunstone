import { createFileRoute } from '@tanstack/react-router';

// The page itself is in account.lazy.tsx, downloaded only when someone opens it.
export const Route = createFileRoute('/account')({});
