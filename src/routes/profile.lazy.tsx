import { createLazyFileRoute } from '@tanstack/react-router';

import ProfilesPage from '@/pages/ProfilesPage';

export const Route = createLazyFileRoute('/profile')({
  component: ProfilesPage,
});
