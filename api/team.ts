// The Team page: who has access and to what. Super admins and HQ only.
//
//   GET  /api/team                                          members + campuses to choose from
//   POST /api/team { action: 'save', email, name, role, campusIds }   add or change someone
//   POST /api/team { action: 'remove', email }                        end someone's access
//
// Super admins and HQ can add, change and remove HQ and campus staff. Nobody can change a
// super admin here (BUILT_IN_SUPER_ADMINS are fixed in code), or their own access.

import {
  BUILT_IN_SUPER_ADMINS,
  type Role,
  type Viewer,
  forgetStaff,
  isEmail,
  json,
  managesTeam,
  normalizeEmail,
  sessionViewer,
} from './_auth';
import { db } from './_db';

export const config = { runtime: 'edge' };

/** Roles a super admin or HQ member may give. */
const ASSIGNABLE: Role[] = ['hq', 'campus'];

async function campuses() {
  const rows = await db()`
    select campus_id as id, campus as name, count(*)::int as students
    from students where on_platform and campus_id is not null
    group by campus_id, campus order by campus`;
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    students: Number(row.students),
  }));
}

/** Why this person cannot be changed by the viewer, or null when they can. */
async function lockedReason(viewer: Viewer, email: string): Promise<string | null> {
  if (email === normalizeEmail(viewer.user)) return 'You cannot change your own access.';
  if (BUILT_IN_SUPER_ADMINS.includes(email)) return 'Super admins cannot be changed here.';
  const [row] = await db()`select role from staff where email = ${email}`;
  if (row?.role === 'super_admin') return 'Super admins cannot be changed here.';
  return null;
}

async function list(viewer: Viewer): Promise<Response> {
  const rows = await db()`
    select email, name, role, campus_ids, added_by,
           (extract(epoch from added_at) * 1000)::float8 as added_at,
           (extract(epoch from last_login_at) * 1000)::float8 as last_login_at
    from staff where active
    order by case role when 'super_admin' then 0 when 'hq' then 1 else 2 end, email`;
  const me = normalizeEmail(viewer.user);
  const members = rows.map((row) => {
    const email = String(row.email);
    const superAdmin = row.role === 'super_admin' || BUILT_IN_SUPER_ADMINS.includes(email);
    return {
      email,
      name: row.name ? String(row.name) : null,
      role: superAdmin ? 'super_admin' : row.role,
      campusIds: (row.campus_ids as number[]) ?? [],
      addedBy: row.added_by ? String(row.added_by) : null,
      addedAt: row.added_at,
      lastLoginAt: row.last_login_at,
      editable: !superAdmin && email !== me,
    };
  });
  // Built-in super admins appear even before they have a row.
  for (const email of BUILT_IN_SUPER_ADMINS) {
    if (!members.some((member) => member.email === email)) {
      members.unshift({
        email,
        name: null,
        role: 'super_admin',
        campusIds: [],
        addedBy: 'built-in',
        addedAt: null,
        lastLoginAt: null,
        editable: false,
      });
    }
  }
  return json(200, { members, campuses: await campuses(), assignable: ASSIGNABLE, me });
}

async function save(viewer: Viewer, body: Record<string, unknown>): Promise<Response> {
  const email = normalizeEmail(typeof body.email === 'string' ? body.email : '');
  if (!isEmail(email)) return json(400, { error: 'Enter a valid email address.' });
  const role = body.role as Role;
  if (!ASSIGNABLE.includes(role)) return json(400, { error: 'Choose HQ or Campus access.' });
  const name =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 100) : null;

  const locked = await lockedReason(viewer, email);
  if (locked) return json(403, { error: locked });

  let campusIds: number[] = [];
  if (role === 'campus') {
    const wanted = Array.isArray(body.campusIds) ? body.campusIds.map(Number) : [];
    const known = new Set((await campuses()).map((campus) => campus.id));
    campusIds = [...new Set(wanted)].filter((id) => known.has(id));
    if (!campusIds.length) return json(400, { error: 'Choose at least one campus.' });
  }

  await db()`
    insert into staff (email, name, role, campus_ids, added_by, active)
    values (${email}, ${name}, ${role}, ${campusIds}::int[], ${normalizeEmail(viewer.user)}, true)
    on conflict (email) do update set
      name = coalesce(excluded.name, staff.name),
      role = excluded.role,
      campus_ids = excluded.campus_ids,
      active = true,
      added_by = case when staff.active then staff.added_by else excluded.added_by end,
      updated_at = now()`;
  forgetStaff(email);
  return json(200, { ok: true });
}

async function remove(viewer: Viewer, body: Record<string, unknown>): Promise<Response> {
  const email = normalizeEmail(typeof body.email === 'string' ? body.email : '');
  if (!isEmail(email)) return json(400, { error: 'Enter a valid email address.' });
  const locked = await lockedReason(viewer, email);
  if (locked) return json(403, { error: locked });

  await db()`update staff set active = false, updated_at = now() where email = ${email}`;
  await db()`delete from login_codes where email = ${email}`;
  forgetStaff(email);
  return json(200, { ok: true });
}

export default async function handler(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL) return json(404, { error: 'No database configured' });
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Login required' });
  if (!managesTeam(viewer))
    return json(403, { error: 'Only super admins and HQ manage the team.' });

  try {
    if (request.method === 'GET') return await list(viewer);
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    if (body.action === 'save') return await save(viewer, body);
    if (body.action === 'remove') return await remove(viewer, body);
    return json(400, { error: 'Unknown action' });
  } catch (error) {
    console.error('[team]', error);
    return json(503, { error: 'Could not update the team. Try again in a minute.' });
  }
}
