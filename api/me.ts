// GET /api/me -> who is signed in and what they may see, 401 otherwise. Lets the app show
// the person, their role, and the Team page to those who manage it.

import { json, managesTeam, sessionViewer } from './_auth';
import { db } from './_db';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Not logged in' });

  // Campus staff: the names of their campuses, for the header and empty states.
  let campuses: { id: number; name: string }[] | null = null;
  if (viewer.campusIds !== null) {
    const rows = viewer.campusIds.length
      ? await db()`
          select distinct campus_id as id, campus as name from students
          where campus_id = any(${viewer.campusIds}::int[]) order by campus`
      : [];
    campuses = rows.map((row) => ({ id: Number(row.id), name: String(row.name) }));
  }

  return json(200, {
    user: viewer.user,
    name: viewer.name,
    picture: viewer.picture,
    role: viewer.role,
    campuses,
    managesTeam: managesTeam(viewer),
  });
}
