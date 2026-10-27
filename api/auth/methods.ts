// GET /api/auth/methods -> which ways of signing in are set up, so the login page only
// offers those.

import { canSignSessions, isConfigured, json } from '../_auth';
import { canSendEmail } from '../_email';
import { googleConfigured } from './_google';

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  const sessions = canSignSessions();
  return json(200, {
    google: sessions && googleConfigured(),
    email: sessions && Boolean(process.env.DATABASE_URL) && canSendEmail(),
    password: isConfigured(),
  });
}
