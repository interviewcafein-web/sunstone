// GET /api/auth/google-callback?code=…&state=… -> Google sends the browser back here. The code
// is exchanged with Google directly (server to server, over TLS), so the ID token it returns
// can be trusted without checking its signature; its audience, issuer, expiry and verified
// email are still checked. Only staff emails get a session.

import {
  OAUTH_COOKIE,
  type OAuthState,
  googleConfigured,
  loginError,
  oauthCookie,
  redirect,
  redirectUri,
} from './_google';
import {
  SESSION_DAYS,
  createSession,
  forgetStaff,
  isStaff,
  normalizeEmail,
  readCookie,
  sessionCookie,
  unsign,
} from '../_auth';
import { db } from '../_db';

export const config = { runtime: 'edge' };

interface IdToken {
  iss: string;
  aud: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

function decodeIdToken(token: string): IdToken | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(
      new TextDecoder().decode(Uint8Array.from(atob(payload), (char) => char.charCodeAt(0)))
    );
  } catch {
    return null;
  }
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clearState = oauthCookie(request, '', 0);
  const state = await unsign<OAuthState>(readCookie(request, OAUTH_COOKIE));
  const next = state?.n ?? '/';

  if (!googleConfigured()) return loginError('google_not_configured', next, [clearState]);
  // Cancelled on Google's screen, or an old/forged callback.
  if (url.searchParams.get('error')) return loginError('google_cancelled', next, [clearState]);
  if (!state || state.e < Date.now() || state.s !== url.searchParams.get('state')) {
    return loginError('google_expired', next, [clearState]);
  }

  let token: IdToken | null = null;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: url.searchParams.get('code') ?? '',
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(request),
        grant_type: 'authorization_code',
      }),
    });
    const body = (await response.json()) as { id_token?: string };
    token = response.ok && body.id_token ? decodeIdToken(body.id_token) : null;
  } catch (error) {
    console.error('[google]', error);
  }

  const valid =
    token &&
    token.aud === process.env.GOOGLE_CLIENT_ID &&
    ['accounts.google.com', 'https://accounts.google.com'].includes(token.iss) &&
    token.exp * 1000 > Date.now() &&
    token.email_verified === true &&
    typeof token.email === 'string';
  if (!valid) return loginError('google_failed', next, [clearState]);

  const email = normalizeEmail(token!.email!);
  if (!(await isStaff(email).catch(() => false))) {
    return loginError('not_staff', next, [clearState]);
  }
  // Their Google photo for the header menu, and their Google name unless one was set on the
  // Team page. Only Google's own image host is accepted.
  const picture = token!.picture?.startsWith('https://lh3.googleusercontent.com/')
    ? token!.picture
    : null;
  const name = token!.name?.trim().slice(0, 100) || null;
  await db()`
    update staff set last_login_at = now(), picture = ${picture}, name = coalesce(name, ${name})
    where email = ${email}`.catch(() => undefined);
  forgetStaff(email);

  return redirect(next, [
    clearState,
    sessionCookie(request, await createSession(email, 'google'), SESSION_DAYS * 86_400),
  ]);
}
