import { createLazyFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import InsightsPage from '@/pages/InsightsPage';

export const Route = createLazyFileRoute('/insights')({
  component: () => (
    <RequireLogin>
      <InsightsPage />
    </RequireLogin>
  ),
});
