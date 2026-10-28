import { createLazyFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import TeamPage from '@/pages/TeamPage';

export const Route = createLazyFileRoute('/team')({
  component: () => (
    <RequireLogin>
      <TeamPage />
    </RequireLogin>
  ),
});
