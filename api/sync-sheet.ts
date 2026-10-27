// POST /api/sync-sheet (signed-in staff) or GET from Vercel Cron (daily, see vercel.json):
// copies coding usernames from the Google Form sheet onto students, matched by email.
// Cron requests carry `Authorization: Bearer $CRON_SECRET`.

import { json, sessionUser } from './_auth';
import { hasDatabase } from './_roster';
import { syncSheet } from './_sheet-sync';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const fromCron = Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
  const staff = request.method === 'POST' && Boolean(await sessionUser(request));
  if (!fromCron && !staff) return json(401, { error: 'Login required' });
  if (!hasDatabase()) return json(404, { error: 'No database configured' });

  try {
    const result = await syncSheet();
    return json(200, {
      sheetEntries: result.sheetEntries,
      matched: result.matched,
      updated: result.updated,
      unmatched: result.unmatched.length,
    });
  } catch (error) {
    console.error('[sync-sheet]', error);
    return json(502, { error: error instanceof Error ? error.message : 'Sync failed' });
  }
}
