import { createFileRoute, redirect } from '@tanstack/react-router';

// The Campuses page used to live at /assessments; old links keep working.
export const Route = createFileRoute('/assessments')({
  beforeLoad: ({ location }) => {
    throw redirect({ href: `/campuses${location.searchStr}`, replace: true });
  },
});
