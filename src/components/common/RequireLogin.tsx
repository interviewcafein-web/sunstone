import { useEffect, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { redirectToLogin, useSession } from '@/lib/session';

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
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {signedOut ? 'Taking you to the login page…' : 'Checking your login…'}
      </p>
    );
  }
  return <>{children}</>;
}
