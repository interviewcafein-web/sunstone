import { useQuery, useQueryClient } from '@tanstack/react-query';

// Who is logged in, from the session cookie that api/login.ts sets. The cookie itself is
// HttpOnly, so the app asks /api/me rather than reading it.

export const SESSION_KEY = ['session'];

async function fetchSession(): Promise<string | null> {
  const response = await fetch('/api/me');
  if (!response.ok) return null;
  return ((await response.json()) as { user: string }).user;
}

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export async function logIn(username: string, password: string): Promise<string> {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = (await response.json().catch(() => null)) as {
    user?: string;
    error?: string;
  } | null;
  if (!response.ok || !body?.user) throw new Error(body?.error ?? 'Could not log in.');
  return body.user;
}

/** Logs out and forgets everything this browser cached about students. */
export function useLogOut() {
  const queryClient = useQueryClient();
  return async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => undefined);
    queryClient.clear();
    try {
      localStorage.removeItem('sunstone:query-cache');
    } catch {
      // Storage blocked: nothing was saved there anyway.
    }
    window.location.assign('/login');
  };
}

/** Sends the visitor to the login page and back here afterwards (session expired mid-visit). */
export function redirectToLogin() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}
