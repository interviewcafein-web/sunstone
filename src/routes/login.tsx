import { createFileRoute } from '@tanstack/react-router';

import LoginPage from '@/pages/LoginPage';

export interface LoginSearch {
  /** Where to go after logging in; only paths on this site are honoured. */
  next?: string;
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const next = typeof search.next === 'string' ? search.next : undefined;
    // "/students" yes; "//evil.example" or "https://…" no.
    return { next: next && next.startsWith('/') && !next.startsWith('//') ? next : undefined };
  },
  component: LoginPage,
});
