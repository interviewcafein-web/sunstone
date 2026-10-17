// POST /api/logout -> clears the session cookie.

import { json, sessionCookie } from './_auth';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(request, '', 0) });
}
