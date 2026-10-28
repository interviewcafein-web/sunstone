import { createFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import AccountPage from '@/pages/AccountPage';

export const Route = createFileRoute('/account')({
  component: () => (
    <RequireLogin>
      <AccountPage />
    </RequireLogin>
  ),
});
