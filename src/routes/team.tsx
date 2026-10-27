import { createFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import TeamPage from '@/pages/TeamPage';

export const Route = createFileRoute('/team')({
  component: () => (
    <RequireLogin>
      <TeamPage />
    </RequireLogin>
  ),
});
