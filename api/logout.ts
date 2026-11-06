// POST /api/logout -> clears the session cookie.

import { json, sessionCookie } from './_auth';
import { forApp } from './_app';

export const config = { runtime: 'edge' };

async function handler(request: Request): Promise<Response> {
  return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(request, '', 0) });
}

export default forApp(handler);
