// The notification bell. Every signed-in staff member reads theirs; super admins and HQ send.
//
//   GET  /api/notifications                       latest 30 for the viewer, unread count, and
//                                                 (for senders) the campuses to address
//   POST /api/notifications { action: 'read', ids?: number[] }        mark read (all if no ids)
//   POST /api/notifications { action: 'send', title, body, link?, level, audience,
//                             campusIds?, email? }                     send; email also mails it
//
// Who sees what: audience "all" reaches everyone, "hq" only HQ and super admins, "campus" the
// staff of the chosen campuses. HQ and super admins see every notification.

import { type Viewer, json, managesTeam, normalizeEmail, sessionViewer } from './_auth';
import { db } from './_db';
import { notificationEmail, sendEmails } from './_email';

export const config = { runtime: 'edge' };

const LEVELS = ['info', 'important', 'urgent'] as const;
const AUDIENCES = ['all', 'hq', 'campus'] as const;

/** HQ and super admins see every notification; password accounts count as HQ. */
const seesAll = (viewer: Viewer) => viewer.role !== 'campus';

// $1 = sees everything, $2 = the viewer's campus ids.
const VISIBLE = `(n.audience = 'all' or $1::boolean
  or (n.audience = 'campus' and n.campus_ids && coalesce($2::int[], '{}')))`;

async function list(viewer: Viewer) {
  const me = normalizeEmail(viewer.user);
  const params = [seesAll(viewer), viewer.campusIds, me];
  const items = await db().query(
    `select n.id::int as id, n.title, n.body, n.link, n.level, n.audience, n.campus_ids,
            (extract(epoch from n.created_at) * 1000)::float8 as at,
            coalesce(s.name, n.created_by) as sender, n.emailed,
            (r.email is not null) as read
     from notifications n
     left join notification_reads r on r.notification_id = n.id and r.email = $3
     left join staff s on s.email = n.created_by
     where ${VISIBLE}
     order by n.created_at desc limit 30`,
    params
  );
  const [{ unread }] = await db().query(
    `select count(*)::int as unread from notifications n
     where ${VISIBLE} and n.created_at > now() - interval '90 days'
       and not exists (select 1 from notification_reads r where r.notification_id = n.id and r.email = $3)`,
    params
  );
  const canSend = managesTeam(viewer);
  const campuses = canSend
    ? await db()`
        select campus_id::int as id, campus as name from students
        where on_platform and campus_id is not null
        group by campus_id, campus order by campus`
    : [];
  return { items, unread, canSend, campuses };
}

async function markRead(viewer: Viewer, ids: unknown) {
  const me = normalizeEmail(viewer.user);
  const chosen = Array.isArray(ids)
    ? ids.filter((id): id is number => Number.isInteger(id) && id > 0).slice(0, 200)
    : null;
  await db().query(
    `insert into notification_reads (notification_id, email)
     select n.id, $3 from notifications n
     where ${VISIBLE} and ($4::bigint[] is null or n.id = any($4::bigint[]))
     on conflict do nothing`,
    [seesAll(viewer), viewer.campusIds, me, chosen]
  );
}

/** A path on this site or an https address; anything else is dropped. */
function safeLink(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const link = value.trim();
  if (/^\/(?!\/)\S*$/.test(link)) return link;
  try {
    const url = new URL(link);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function send(viewer: Viewer, body: Record<string, unknown>) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  const level = LEVELS.find((item) => item === body.level) ?? 'info';
  const audience = AUDIENCES.find((item) => item === body.audience) ?? 'all';
  const campusIds = Array.isArray(body.campusIds)
    ? [...new Set(body.campusIds.filter((id): id is number => Number.isInteger(id) && id > 0))]
    : [];
  const link = safeLink(body.link);
  if (!title || title.length > 140)
    return json(400, { error: 'Add a title (up to 140 characters).' });
  if (text.length > 2000)
    return json(400, { error: 'The message is too long (2,000 characters).' });
  if (audience === 'campus' && !campusIds.length) {
    return json(400, { error: 'Choose at least one campus.' });
  }
  if (typeof body.link === 'string' && body.link.trim() && !link) {
    return json(400, { error: 'The link must start with / or https://' });
  }

  const me = normalizeEmail(viewer.user);
  const [created] = await db()`
    insert into notifications (title, body, link, level, audience, campus_ids, created_by)
    values (${title}, ${text}, ${link}, ${level}, ${audience}, ${campusIds}::int[], ${me})
    returning id::int as id`;
  // The sender has read their own notification.
  await db()`insert into notification_reads (notification_id, email) values (${created.id}, ${me})`;

  let emailed = 0;
  if (body.email === true) {
    const recipients = await db()`
      select email from staff
      where active and email <> ${me} and position('@' in email) > 0 and (
        ${audience} = 'all'
        or (${audience} = 'hq' and role in ('hq', 'super_admin'))
        or (${audience} = 'campus' and role = 'campus' and campus_ids && ${campusIds}::int[]))`;
    const message = notificationEmail({
      title,
      body: text,
      link,
      level,
      sender: viewer.name ?? me,
    });
    emailed = await sendEmails(recipients.map((row) => ({ to: String(row.email), ...message })));
    await db()`update notifications set emailed = ${emailed} where id = ${created.id}`;
  }
  return json(200, { id: created.id, emailed });
}

export default async function handler(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL) return json(404, { error: 'No database configured' });
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Login required' });

  try {
    if (request.method === 'GET') return json(200, await list(viewer));
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.action === 'read') {
      await markRead(viewer, body.ids);
      return json(200, { ok: true });
    }
    if (body.action === 'send') {
      if (!managesTeam(viewer)) return json(403, { error: 'Only HQ can send notifications.' });
      return await send(viewer, body);
    }
    return json(400, { error: 'Unknown action' });
  } catch (error) {
    console.error('[notifications]', error);
    return json(503, {
      error:
        error instanceof Error && error.message.startsWith('Resend')
          ? 'Saved to the bell, but the email could not be sent.'
          : 'Notifications could not be loaded. Try again shortly.',
    });
  }
}
