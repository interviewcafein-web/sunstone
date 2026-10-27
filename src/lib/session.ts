import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Role } from './roles';

// Who is logged in, from the session cookie that api/login.ts sets. The cookie itself is
// HttpOnly, so the app asks /api/me rather than reading it.

export const SESSION_KEY = ['session'];

export interface SessionInfo {
  /** Email (or a bootstrap password username). */
  user: string;
  name: string | null;
  role: Role;
  /** Campus staff: the campuses they see. Null for HQ and super admins (every campus). */
  campuses: { id: number; name: string }[] | null;
  /** Super admins and HQ: may open the Team page. */
  managesTeam: boolean;
}

async function fetchSession(): Promise<SessionInfo | null> {
  const response = await fetch('/api/me');
  if (!response.ok) return null;
  return (await response.json()) as SessionInfo;
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

export interface SignInMethods {
  google: boolean;
  email: boolean;
  password: boolean;
}

/** Which ways of signing in are set up on this site. */
export function useSignInMethods() {
  return useQuery({
    queryKey: ['sign-in-methods'],
    queryFn: async (): Promise<SignInMethods> => {
      const response = await fetch('/api/auth/methods');
      if (!response.ok) return { google: false, email: false, password: true };
      return response.json();
    },
    staleTime: 10 * 60_000,
  });
}

async function otp(body: object): Promise<{ user?: string; message?: string }> {
  const response = await fetch('/api/auth/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => null)) as {
    user?: string;
    message?: string;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(result?.error ?? 'Something went wrong. Try again.');
  return result ?? {};
}

/** Emails a sign-in code; resolves with the message to show (the same for every email). */
export async function sendSignInCode(email: string): Promise<string> {
  return (await otp({ action: 'send', email })).message ?? 'Check your email for a code.';
}

export async function verifySignInCode(email: string, code: string): Promise<string> {
  const { user } = await otp({ action: 'verify', email, code });
  if (!user) throw new Error('Could not sign in.');
  return user;
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
