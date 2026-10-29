// POST /api/push { token, platform }   registers this phone for the signed-in person's pushes
// DELETE /api/push { token }           stops them (on sign-out)

import { json, normalizeEmail, sessionViewer } from './_auth';
import { db } from './_db';

export const config = { runtime: 'edge' };

const isExpoToken = (value: unknown): value is string =>
  typeof value === 'string' && /^Expo(nent)?PushToken\[[\w-]{10,}\]$/.test(value);

export default async function handler(request: Request): Promise<Response> {
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Login required' });
  const body = (await request.json().catch(() => ({}))) as { token?: unknown; platform?: unknown };
  if (!isExpoToken(body.token)) return json(400, { error: 'Not a push token' });
  try {
    if (request.method === 'POST') {
      const platform = typeof body.platform === 'string' ? body.platform.slice(0, 10) : null;
      await db()`
        insert into push_devices (token, email, platform)
        values (${body.token}, ${normalizeEmail(viewer.user)}, ${platform})
        on conflict (token) do update set email = excluded.email, platform = excluded.platform,
          updated_at = now(), disabled = false`;
      return json(200, { ok: true });
    }
    if (request.method === 'DELETE') {
      await db()`delete from push_devices where token = ${body.token}`;
      return json(200, { ok: true });
    }
    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('[push]', error);
    return json(503, { error: 'Could not save this device.' });
  }
}
