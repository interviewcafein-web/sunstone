import { createLazyFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import AccountPage from '@/pages/AccountPage';

export const Route = createLazyFileRoute('/account')({
  component: () => (
    <RequireLogin>
      <AccountPage />
    </RequireLogin>
  ),
});
