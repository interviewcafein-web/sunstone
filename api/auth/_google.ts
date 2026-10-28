// Shared by the two Google sign-in functions. Configure in Google Cloud Console
// (APIs & Services -> Credentials -> OAuth client ID, type "Web application"), with each
// site address's callback as an authorised redirect URI:
//   https://<site>/api/auth/google-callback   (and http://localhost:3002/... for local)
// then set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.

export const OAUTH_COOKIE = 'sunstone_oauth';
export const OAUTH_MINUTES = 10;

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** The callback address on whichever host the request came in on. */
export const redirectUri = (request: Request) =>
  `${new URL(request.url).origin}/api/auth/google-callback`;

/** Only paths on this site: "/students" yes, "//evil.example" or "https://…" no. */
export const safeNext = (next: string | null | undefined) =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

/** State kept in a signed cookie between leaving for Google and coming back. */
export interface OAuthState {
  /** Random value echoed by Google, so a callback cannot be forged from another site. */
  s: string;
  /** Where to go after signing in. */
  n: string;
  /** Expiry, ms since 1970. */
  e: number;
  /** The mobile app's return address (vertex://… or Expo Go's exp://…), when it started this. */
  a?: string;
}

/** A mobile app return address: only the Vertex app's own scheme, or Expo Go while testing. */
export const safeAppReturn = (value: string | null | undefined) =>
  value && /^(vertex|exps?):\/\/[\w.:\-/@%?=&]*$/i.test(value) && value.length < 300
    ? value
    : undefined;

/** Back to the app with the outcome (a session token, or why sign-in failed). */
export const appReturn = (to: string, params: Record<string, string>, cookies: string[] = []) =>
  redirect(`${to}${to.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`, cookies);

export function oauthCookie(request: Request, value: string, maxAgeSeconds: number) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${OAUTH_COOKIE}=${value}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

/** Back to the login page with a reason the page explains. */
export const loginError = (reason: string, next = '/', cookies: string[] = []) =>
  redirect(`/login?error=${encodeURIComponent(reason)}&next=${encodeURIComponent(next)}`, cookies);
