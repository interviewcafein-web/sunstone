// Automatic notifications from the scripts (new tests, weekly reports): a row in the bell,
// and an email to the people it is for. Campus notifications go to that campus's staff with
// HQ and super admins copied in, except the founders, who get only the HQ-wide ones (the
// all-campus weekly report), not one per campus; HQ notifications go to all of HQ.

import type { NeonQueryFunction } from '@neondatabase/serverless';

import type { Email } from '../api/_email';
import { pushTo } from '../api/_push';

/** Shown as the sender in the bell. */
export const SYSTEM_SENDER = 'Vertex';

/**
 * The founders: they get HQ-wide notices (one all-campus weekly report), not the copy of
 * every campus's, which would be a score of emails each Monday.
 */
const HQ_WIDE_ONLY = new Set(['ankur@sunstone.in', 'ashish@sunstone.in', 'piyush@sunstone.in']);

export interface Directory {
  /** Every HQ member and super admin: HQ-wide notices. */
  hq: string[];
  /** HQ copied on each campus's notices (everyone in `hq` but the founders). */
  hqCopied: string[];
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
  return { hq, hqCopied: hq.filter((email) => !HQ_WIDE_ONLY.has(email)), campus };
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
  // HQ on this notice: all of HQ for an HQ-wide one, HQ but the founders for a campus's.
  const hq = notice.campusId === null ? directory.hq : directory.hqCopied;
  // Phones of the people it is for: the campus's staff and HQ.
  await pushTo([...new Set([...campusStaff, ...hq])], {
    title: notice.title,
    body: notice.body,
    link: notice.link,
  }).catch((error) => console.error('[push]', error));
  const to = campusStaff.length ? campusStaff : hq;
  if (!to.length) return null;
  const cc = campusStaff.length ? hq.filter((email) => !campusStaff.includes(email)) : [];
  await sql`update notifications set emailed = ${to.length + cc.length} where id = ${row.id}`;
  return { to, cc, ...notice.email };
}
