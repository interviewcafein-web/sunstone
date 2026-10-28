// GET  /api/me -> who is signed in, their profile and what they may see; 401 otherwise.
// POST /api/me { name, mobile, designation, bio } -> update your own profile (staff signed in
//      with Google or an emailed code; bootstrap password accounts have no profile).

import { json, managesTeam, normalizeEmail, sessionViewer, forgetStaff } from './_auth';
import { db } from './_db';

export const config = { runtime: 'edge' };

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim()
    ? value.trim().replace(/\s+/g, ' ').slice(0, max)
    : null;

export default async function handler(request: Request): Promise<Response> {
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Not logged in' });
  const email = normalizeEmail(viewer.user);
  const hasProfile = Boolean(process.env.DATABASE_URL) && email.includes('@');

  if (request.method === 'POST') {
    if (!hasProfile) return json(400, { error: 'This account has no profile to edit.' });
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const mobile = text(body.mobile, 20);
    if (mobile && !/^\+?[\d\s-]{10,16}$/.test(mobile)) {
      return json(400, { error: 'Enter a valid mobile number.' });
    }
    // Paragraph breaks are kept in the description.
    const bio =
      typeof body.bio === 'string' && body.bio.trim() ? body.bio.trim().slice(0, 600) : null;
    await db()`
      update staff set name = ${text(body.name, 100)}, mobile = ${mobile},
             designation = ${text(body.designation, 80)}, bio = ${bio}, updated_at = now()
      where email = ${email}`;
    forgetStaff(email);
  }

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

  const [profile] = hasProfile
    ? await db()`
        select name, picture, mobile, designation, bio,
               (extract(epoch from last_login_at) * 1000)::float8 as last_login_at
        from staff where email = ${email}`
    : [];

  return json(200, {
    user: viewer.user,
    name: profile?.name ?? viewer.name,
    picture: profile?.picture ?? viewer.picture,
    mobile: profile?.mobile ?? null,
    designation: profile?.designation ?? null,
    bio: profile?.bio ?? null,
    lastLoginAt: profile?.last_login_at ?? null,
    hasProfile,
    role: viewer.role,
    campuses,
    managesTeam: managesTeam(viewer),
  });
}
