// GET /api/health -> whether the database answers, and how fast. Staff only, so bots can't
// keep waking the database (Neon's free tier sleeps it when idle).

import { json, sessionUser } from './_auth';
import { db } from './_db';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (!(await sessionUser(request))) return json(401, { error: 'Not logged in' });

  const started = Date.now();
  try {
    const [row] = await db()`select version() as version, now() as time`;
    return json(200, {
      database: 'ok',
      ms: Date.now() - started,
      version: String(row.version).split(' on ')[0],
      time: row.time,
    });
  } catch (error) {
    return json(503, {
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}
