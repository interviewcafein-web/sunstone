// GET /api/auth/methods -> which ways of signing in are set up, so the login page only
// offers those.

import { emailCodesConfigured, googleSignInConfigured, json, passwordLoginEnabled } from '../_auth';

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  return json(200, {
    google: googleSignInConfigured(),
    email: emailCodesConfigured(),
    password: await passwordLoginEnabled(),
  });
}
