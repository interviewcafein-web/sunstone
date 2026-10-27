// POST /api/login { username, password } -> sets the session cookie. Only while password
// sign-in is still enabled (see passwordLoginEnabled in _auth.ts); afterwards staff sign in
// with Google or an emailed code.

import {
  SESSION_DAYS,
  checkPassword,
  createSession,
  passwordLoginEnabled,
  json,
  sessionCookie,
} from './_auth';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!(await passwordLoginEnabled())) {
    return json(403, {
      error: 'Password sign-in is turned off. Sign in with Google or an emailed code.',
    });
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
