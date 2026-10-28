// GET /api/auth/google?next=/path -> sends the browser to Google's sign-in page.
// GET /api/auth/google?app=vertex://auth -> the same for the mobile app, which gets the session
// token back on that address (see google-callback.ts).

import { canSignSessions, sign } from '../_auth';
import {
  OAUTH_MINUTES,
  type OAuthState,
  googleConfigured,
  loginError,
  oauthCookie,
  redirect,
  redirectUri,
  safeAppReturn,
  safeNext,
} from './_google';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const next = safeNext(params.get('next'));
  const app = safeAppReturn(params.get('app'));
  if (!googleConfigured() || !canSignSessions()) return loginError('google_not_configured', next);

  const random = crypto.getRandomValues(new Uint8Array(18));
  const state: OAuthState = {
    s: btoa(String.fromCharCode(...random)).replace(/[+/=]/g, ''),
    n: next,
    e: Date.now() + OAUTH_MINUTES * 60_000,
    ...(app ? { a: app } : {}),
  };

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(request),
    response_type: 'code',
    scope: 'openid email profile',
    state: state.s,
    prompt: 'select_account',
  }).toString();

  return redirect(url.toString(), [oauthCookie(request, await sign(state), OAUTH_MINUTES * 60)]);
}
