// POST /api/login { username, password } -> sets the session cookie.

import {
  SESSION_DAYS,
  checkPassword,
  createSession,
  isConfigured,
  json,
  sessionCookie,
} from './_auth';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!isConfigured()) {
    return json(503, { error: 'Login is not set up yet (AUTH_USERS / AUTH_SECRET).' });
  }

  const body = (await request.json().catch(() => null)) as {
    username?: unknown;
    password?: unknown;
  } | null;
  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const user = username && password ? await checkPassword(username, password) : null;
  if (!user) {
    // A short pause makes guessing passwords slower.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return json(401, { error: 'Wrong username or password.' });
  }

  return json(
    200,
    { user },
    {
      'Set-Cookie': sessionCookie(request, await createSession(user), SESSION_DAYS * 86_400),
    }
  );
}
