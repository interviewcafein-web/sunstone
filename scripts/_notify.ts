// Automatic notifications from the scripts (new tests, weekly reports): a row in the bell,
// and an email to the people it is for. Campus notifications go to that campus's staff with
// every HQ member and super admin copied in; HQ notifications go to HQ.

import type { NeonQueryFunction } from '@neondatabase/serverless';

import type { Email } from '../api/_email';
import { pushTo } from '../api/_push';

/** Shown as the sender in the bell. */
export const SYSTEM_SENDER = 'Vertex';

export interface Directory {
  hq: string[];
  campus: Map<number, string[]>;
}

/** Who to email: active HQ and super admins, and campus staff by campus. */
export async function staffDirectory(sql: NeonQueryFunction<false, false>): Promise<Directory> {
  const rows = await sql`
    select email, role, campus_ids from staff
    where active and position('@' in email) > 0`;
  const hq: string[] = [];
  const campus = new Map<number, string[]>();
  for (const row of rows) {
    const email = String(row.email);
    if (row.role === 'campus') {
      for (const id of (row.campus_ids as number[]) ?? []) {
        campus.set(id, [...(campus.get(id) ?? []), email]);
      }
    } else {
      hq.push(email);
    }
  }
  return { hq, campus };
}

export interface Notice {
  title: string;
  body: string;
  link: string;
  level: 'info' | 'important' | 'urgent';
  /** A campus notice, or null for HQ only. */
  campusId: number | null;
  email: Pick<Email, 'subject' | 'text' | 'html'>;
}

/** Puts the notice in the bell and returns the email to send (to campus staff, cc HQ). */
export async function addNotice(
  sql: NeonQueryFunction<false, false>,
  directory: Directory,
  notice: Notice
): Promise<Email | null> {
  const [row] = await sql`
    insert into notifications (title, body, link, level, audience, campus_ids, created_by)
    values (${notice.title}, ${notice.body}, ${notice.link}, ${notice.level},
            ${notice.campusId === null ? 'hq' : 'campus'},
            ${notice.campusId === null ? [] : [notice.campusId]}::int[], ${SYSTEM_SENDER})
    returning id`;
  const campusStaff = notice.campusId === null ? [] : (directory.campus.get(notice.campusId) ?? []);
  // Phones of everyone who sees it in the bell: the campus's staff and HQ.
  await pushTo([...new Set([...campusStaff, ...directory.hq])], {
    title: notice.title,
    body: notice.body,
    link: notice.link,
  }).catch((error) => console.error('[push]', error));
  const to = campusStaff.length ? campusStaff : directory.hq;
  if (!to.length) return null;
  const cc = campusStaff.length ? directory.hq.filter((email) => !campusStaff.includes(email)) : [];
  await sql`update notifications set emailed = ${to.length + cc.length} where id = ${row.id}`;
  return { to, cc, ...notice.email };
}
