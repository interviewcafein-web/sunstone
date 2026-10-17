// GET /api/me -> { user } when logged in, 401 otherwise. Lets the app show who is signed in.

import { json, sessionUser } from './_auth';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const user = await sessionUser(request);
  return user ? json(200, { user }) : json(401, { error: 'Not logged in' });
}
