import { useEffect, type ReactNode } from 'react';

import { redirectToLogin, useSession } from '@/lib/session';
import { PageLoader } from '@/components/common/PageLoader';

/**
 * Staff-only pages. The data behind them is protected on the server (api/students.ts
 * answers 401 without a login); this only sends visitors to the login page instead of
 * showing them an empty screen.
 */
export function RequireLogin({ children }: { children: ReactNode }) {
  const session = useSession();
  const signedOut = session.isSuccess && !session.data;

  useEffect(() => {
    if (signedOut) redirectToLogin();
  }, [signedOut]);

  if (!session.data) {
    return (
      <PageLoader
        variant="plain"
        label={signedOut ? 'Taking you to the login page' : 'Checking your login'}
      />
    );
  }
  return <>{children}</>;
}
