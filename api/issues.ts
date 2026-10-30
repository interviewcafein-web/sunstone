// Campus issues: campus staff raise operational problems for their campuses (from the fixed
// categories in src/lib/issues.ts); each goes to the central team, Tarun Sharma by default,
// and stays open, and listed in the weekly email, until it is resolved.
//
//   GET  /api/issues?status=active|resolved|all&campus=ID    the issues the viewer can see
//   GET  /api/issues?id=N                                     one issue with its thread
//   POST /api/issues { action: 'create', campusId, category, priority, location?, details }
//   POST /api/issues { action: 'reply', id, body }
//   POST /api/issues { action: 'status', id, status, note? }
//   POST /api/issues { action: 'assign', id, assignee }
//
// Who may do what: campus staff see and raise issues for their campuses; HQ and super admins
// see every campus, and anyone sees the issues assigned to them. Replies are open to anyone
// who can see the issue. The status changes by HQ, super admins or the assignee (the holder);
// the person who raised it may reopen it. HQ, super admins and the holder hand it on, to
// anyone on the team. Each new issue is emailed (and pushed to the app) to the assignee and to HQ
// (Sarvesh and Tarun Sharma, see DEFAULT_NOTIFY); each reply and change to the others on it:
// the person who raised it and the assignee.

import {
  ISSUE_CATEGORIES,
  PRIORITIES,
  STATUSES,
  categoryLabel,
  statusOf,
  type IssueStatus,
} from '../src/lib/issues';
import { type Viewer, seesCampus, json, managesTeam, normalizeEmail, sessionViewer } from './_auth';
import { db } from './_db';
import { SITE, notificationEmail, sendEmail } from './_email';
import { pushTo } from './_push';

export const config = { runtime: 'edge' };

/** New issues go to the central team: Tarun Sharma, unless ISSUES_ASSIGNEE says otherwise. */
const DEFAULT_ASSIGNEE = 'tarun.sharma@sunstone.in';

/**
 * HQ who hear of every new issue from every campus (besides the assignee): Sarvesh and Tarun
 * Sharma, unless ISSUES_NOTIFY (comma-separated emails) says otherwise.
 */
const DEFAULT_NOTIFY = ['sarvesh@sunstone.in', 'tarun.sharma@sunstone.in'];
const notifyOnNew = () =>
  (process.env.ISSUES_NOTIFY?.trim() ? process.env.ISSUES_NOTIFY.split(',') : DEFAULT_NOTIFY)
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

const ISSUE_FIELDS = `
  i.id::int as id, i.campus_id::int as "campusId", coalesce(c.name, 'Campus ' || i.campus_id) as campus,
  i.category, i.priority, i.location, i.details, i.status,
  json_build_object('email', i.raised_by, 'name', r.name) as "raisedBy",
  json_build_object('email', i.assigned_to, 'name', a.name) as "assignedTo",
  (extract(epoch from i.created_at) * 1000)::float8 as "createdAt",
  (extract(epoch from i.updated_at) * 1000)::float8 as "updatedAt",
  (extract(epoch from i.resolved_at) * 1000)::float8 as "resolvedAt",
  (select count(*)::int from issue_updates u where u.issue_id = i.id and u.kind = 'comment') as replies`;

// Campus names as the students list has them.
const CAMPUSES = `(select campus_id, min(campus) as name from students
  where campus_id is not null group by campus_id)`;

const FROM = `from issues i
  left join ${CAMPUSES} c on c.campus_id = i.campus_id
  left join staff r on r.email = i.raised_by
  left join staff a on a.email = i.assigned_to`;

/**
 * Campus staff see their campuses' issues and any issue assigned to them; everyone else every
 * campus. `campuses` and `me` are the parameters holding the campus ids (or null) and the email.
 */
const visible = (campuses: string, me: string) =>
  `(${campuses}::int[] is null or i.campus_id = any(${campuses}::int[]) or i.assigned_to = ${me})`;

const me = (viewer: Viewer) => normalizeEmail(viewer.user);

async function list(viewer: Viewer, url: URL) {
  const status = url.searchParams.get('status') ?? 'active';
  const campus = Number(url.searchParams.get('campus')) || null;
  const mine = url.searchParams.get('mine') === '1';
  const statusFilter =
    status === 'resolved'
      ? `i.status = 'resolved'`
      : status === 'all'
        ? 'true'
        : `i.status <> 'resolved'`;
  const [issues, [{ open, mine: mineCount }], campuses, team] = await Promise.all([
    db().query(
      `select ${ISSUE_FIELDS} ${FROM}
       where ${visible('$1', '$3')} and ${statusFilter} and ($2::int is null or i.campus_id = $2)
         and (not $4::boolean or i.assigned_to = $3)
       order by case i.status when 'open' then 0 when 'in_progress' then 1 else 2 end,
                case i.priority when 'urgent' then 0 when 'high' then 1 else 2 end,
                i.created_at desc
       limit 300`,
      [viewer.campusIds, campus, me(viewer), mine]
    ),
    db().query(
      `select count(*)::int as open, count(*) filter (where i.assigned_to = $2)::int as mine
       from issues i where ${visible('$1', '$2')} and i.status <> 'resolved'`,
      [viewer.campusIds, me(viewer)]
    ),
    db().query(
      `select campus_id::int as id, name from ${CAMPUSES} c
       where $1::int[] is null or campus_id = any($1::int[]) order by name`,
      [viewer.campusIds]
    ),
    // Who an issue can be handed to: every active staff member for HQ; HQ and their own
    // campuses' staff for campus staff (who pass on issues assigned to them).
    db().query(
      `select s.email, s.name, s.role,
              (select string_agg(c.name, ', ' order by c.name) from ${CAMPUSES} c
               where c.campus_id = any(s.campus_ids)) as campus
       from staff s
       where s.active and ($1::int[] is null or s.role <> 'campus' or s.campus_ids && $1::int[])
       order by (s.role = 'campus'), coalesce(s.name, s.email)`,
      [viewer.campusIds]
    ),
  ]);
  return {
    issues,
    openCount: open,
    mineCount,
    campuses,
    team,
    manages: managesTeam(viewer),
    me: me(viewer),
  };
}

async function findIssue(viewer: Viewer, id: number) {
  const [issue] = await db().query(
    `select ${ISSUE_FIELDS} ${FROM} where i.id = $2 and ${visible('$1', '$3')}`,
    [viewer.campusIds, id, me(viewer)]
  );
  return issue ?? null;
}

async function detail(viewer: Viewer, id: number) {
  const issue = await findIssue(viewer, id);
  if (!issue) return null;
  const updates = await db().query(
    `select u.id::int as id, json_build_object('email', u.author, 'name', s.name) as author,
            u.kind, u.body, u.status,
            case when u.assignee is null then null
                 else json_build_object('email', u.assignee, 'name', n.name) end as assignee,
            (extract(epoch from u.at) * 1000)::float8 as at
     from issue_updates u
     left join staff s on s.email = u.author
     left join staff n on n.email = u.assignee
     where u.issue_id = $1 order by u.at`,
    [id]
  );
  return { issue, updates };
}

async function assignee(): Promise<string> {
  const wanted = normalizeEmail(process.env.ISSUES_ASSIGNEE?.trim() || DEFAULT_ASSIGNEE);
  const [row] = await db().query(
    `select email from staff where active and role in ('hq', 'super_admin')
     order by (email = $1) desc, (role = 'super_admin') desc limit 1`,
    [wanted]
  );
  return row ? String(row.email) : wanted;
}

interface Notice {
  title: string;
  body: string;
  level: 'info' | 'important' | 'urgent';
}

/** Emails and pushes `notice` about issue `id` to these people (never the one acting). */
async function tell(
  people: string[],
  actor: string,
  id: number,
  notice: Notice,
  sender: string | null
) {
  const to = [...new Set(people.map(normalizeEmail))].filter((email) => email && email !== actor);
  if (!to.length) return;
  const email = notificationEmail({ ...notice, link: `${SITE}/issues?id=${id}`, sender });
  await Promise.all([
    ...to.map((address) =>
      sendEmail({ to: address, ...email }).catch((error) =>
        console.error('[issues] email failed', address, error)
      )
    ),
    pushTo(to, { title: notice.title, body: notice.body, link: `/issues/${id}` }).catch((error) =>
      console.error('[issues] push failed', error)
    ),
  ]);
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

async function create(viewer: Viewer, body: Record<string, unknown>) {
  const campusId = Number(body.campusId);
  const category = String(body.category ?? '');
  const priority = String(body.priority ?? 'normal');
  const details = text(body.details, 2000);
  const location = text(body.location, 120) || null;
  if (!Number.isInteger(campusId) || !seesCampus(viewer, campusId)) {
    return json(403, { error: 'You can raise issues only for your own campuses.' });
  }
  if (!ISSUE_CATEGORIES.some((item) => item.id === category)) {
    return json(400, { error: 'Choose what the issue is about.' });
  }
  if (!PRIORITIES.some((item) => item.id === priority))
    return json(400, { error: 'Choose a priority.' });
  if (!details) return json(400, { error: 'Describe the issue.' });

  const raisedBy = me(viewer);
  const assignedTo = await assignee();
  const [row] = await db().query(
    `insert into issues (campus_id, category, priority, location, details, raised_by, assigned_to)
     values ($1, $2, $3, $4, $5, $6, $7) returning id::int as id`,
    [campusId, category, priority, location, details, raisedBy, assignedTo]
  );
  const issue = await findIssue(viewer, row.id);
  await tell(
    [assignedTo, ...notifyOnNew()],
    raisedBy,
    row.id,
    {
      title: `New issue at ${issue.campus}: ${categoryLabel(category)}`,
      body: `${details}${location ? `\n\nWhere: ${location}` : ''}\n\nRaised by ${viewer.name ?? raisedBy}. Priority: ${priority}.`,
      level: priority === 'urgent' ? 'urgent' : priority === 'high' ? 'important' : 'info',
    },
    viewer.name ?? raisedBy
  );
  return json(200, { issue });
}

async function reply(viewer: Viewer, body: Record<string, unknown>) {
  const id = Number(body.id);
  const message = text(body.body, 2000);
  if (!message) return json(400, { error: 'Write a reply.' });
  const issue = Number.isInteger(id) ? await findIssue(viewer, id) : null;
  if (!issue) return json(404, { error: 'Issue not found.' });
  const author = me(viewer);
  await db().query(
    `insert into issue_updates (issue_id, author, kind, body) values ($1, $2, 'comment', $3)`,
    [id, author, message]
  );
  await db().query(`update issues set updated_at = now() where id = $1`, [id]);
  await tell(
    [issue.raisedBy.email, issue.assignedTo.email],
    author,
    id,
    {
      title: `Reply on ${issue.campus}: ${categoryLabel(issue.category)}`,
      body: `${viewer.name ?? author}: ${message}`,
      level: 'info',
    },
    viewer.name ?? author
  );
  return json(200, await detail(viewer, id));
}

async function setStatus(viewer: Viewer, body: Record<string, unknown>) {
  const id = Number(body.id);
  const status = String(body.status ?? '') as IssueStatus;
  const note = text(body.note, 2000) || null;
  if (!STATUSES.some((item) => item.id === status)) return json(400, { error: 'Unknown status.' });
  const issue = Number.isInteger(id) ? await findIssue(viewer, id) : null;
  if (!issue) return json(404, { error: 'Issue not found.' });
  const actor = me(viewer);
  const reopening =
    status === 'open' && issue.status === 'resolved' && issue.raisedBy.email === actor;
  if (!managesTeam(viewer) && issue.assignedTo.email !== actor && !reopening) {
    return json(403, { error: 'Only the central team can change this.' });
  }
  if (status === issue.status) return json(200, await detail(viewer, id));

  await db().query(
    `update issues set status = $2, updated_at = now(),
       resolved_at = case when $2 = 'resolved' then now() else null end
     where id = $1`,
    [id, status]
  );
  await db().query(
    `insert into issue_updates (issue_id, author, kind, body, status) values ($1, $2, 'status', $3, $4)`,
    [id, actor, note, status]
  );
  const word = status === 'resolved' ? 'Resolved' : status === 'open' ? 'Reopened' : 'In progress';
  await tell(
    [issue.raisedBy.email, issue.assignedTo.email],
    actor,
    id,
    {
      title: `${word}: ${categoryLabel(issue.category)} at ${issue.campus}`,
      body: `${viewer.name ?? actor} marked it ${statusOf(status).label.toLowerCase()}.${note ? `\n\n${note}` : ''}`,
      level: 'info',
    },
    viewer.name ?? actor
  );
  return json(200, await detail(viewer, id));
}

/**
 * Hands an issue to someone, who then holds it: HQ and super admins, or whoever holds it now,
 * may. HQ can choose any active staff member; campus staff choose HQ or their own campuses'
 * staff. The new holder, the one before and the person who raised it are told.
 */
async function assign(viewer: Viewer, body: Record<string, unknown>) {
  const id = Number(body.id);
  const to = normalizeEmail(String(body.assignee ?? ''));
  const issue = Number.isInteger(id) ? await findIssue(viewer, id) : null;
  if (!issue) return json(404, { error: 'Issue not found.' });
  const actor = me(viewer);
  if (!managesTeam(viewer) && issue.assignedTo.email !== actor) {
    return json(403, { error: 'Only HQ or the person it is assigned to can hand it on.' });
  }
  const [member] = await db().query(
    `select email, name from staff
     where email = $1 and active
       and ($2::int[] is null or role <> 'campus' or campus_ids && $2::int[])`,
    [to, viewer.campusIds]
  );
  if (!member) return json(400, { error: 'Choose someone on the Vertex team.' });
  if (issue.assignedTo.email === to) return json(200, await detail(viewer, id));

  await db().query(`update issues set assigned_to = $2, updated_at = now() where id = $1`, [
    id,
    to,
  ]);
  await db().query(
    `insert into issue_updates (issue_id, author, kind, assignee) values ($1, $2, 'assign', $3)`,
    [id, actor, to]
  );
  const who = viewer.name ?? actor;
  const holder = member.name ?? to;
  const what = `${categoryLabel(issue.category)} at ${issue.campus}`;
  await Promise.all([
    tell(
      [to],
      actor,
      id,
      {
        title: `Assigned to you: ${what}`,
        body: `${who} made you responsible for this issue.\n\n${issue.details}${issue.location ? `\n\nWhere: ${issue.location}` : ''}`,
        level:
          issue.priority === 'urgent' ? 'urgent' : issue.priority === 'high' ? 'important' : 'info',
      },
      who
    ),
    tell(
      [issue.raisedBy.email, issue.assignedTo.email].filter((email) => email !== to),
      actor,
      id,
      {
        title: `Now with ${holder}: ${what}`,
        body:
          to === actor ? `${who} took this issue on.` : `${who} assigned this issue to ${holder}.`,
        level: 'info',
      },
      who
    ),
  ]);
  // Handed to someone else, the issue may no longer be one the viewer can see.
  return json(200, (await detail(viewer, id)) ?? { ok: true });
}

export default async function handler(request: Request): Promise<Response> {
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Sign in to see campus issues.' });
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const id = Number(url.searchParams.get('id'));
    if (id) {
      const found = await detail(viewer, id);
      return found ? json(200, found) : json(404, { error: 'Issue not found.' });
    }
    return json(200, await list(viewer, url));
  }
  if (request.method !== 'POST') return json(405, { error: 'Use GET or POST.' });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return json(400, { error: 'Send JSON.' });
  if (body.action === 'create') return create(viewer, body);
  if (body.action === 'reply') return reply(viewer, body);
  if (body.action === 'status') return setStatus(viewer, body);
  if (body.action === 'assign') return assign(viewer, body);
  return json(400, { error: 'Unknown action.' });
}
