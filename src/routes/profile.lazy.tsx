import { createLazyFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import ProfilesPage from '@/pages/ProfilesPage';

export const Route = createLazyFileRoute('/profile')({
  component: () => (
    <RequireLogin>
      <ProfilesPage />
    </RequireLogin>
  ),
});
