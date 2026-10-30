// The unlisted student form (/coding-usernames): students give their coding usernames
// without signing in, matched on the email Sunstone has for them (personal or Sunstone).
//
//   POST /api/student-form { action: 'lookup', email }
//        -> { firstName, campus, handles }: whose email it is and the usernames saved now
//   POST /api/student-form { action: 'save', email, handles: { leetcode: 'name or link', … } }
//        -> { ok: true, handles }: every username read and checked as the form does
//
// Only the first name and campus are shown, never contact details. Each IP may look up 30
// emails and save 10 times an hour; every lookup and save is kept in student_form_events
// (with the usernames before and after, so a change can be undone). A save also marks the
// form time, so an older Google Form answer synced later does not overwrite it.

import { PLATFORMS } from '../src/lib/coding-profiles/platforms';
import { readHandle } from '../src/lib/coding-profiles/handles';
import type { PlatformId } from '../src/lib/coding-profiles/types';
import { isEmail, json, normalizeEmail } from './_auth';
import { db } from './_db';

export const config = { runtime: 'edge' };

const LIMITS = { lookup: 30, save: 10 } as const;
type Kind = keyof typeof LIMITS;

const IDS = PLATFORMS.map((platform) => platform.id);
type Handles = Record<PlatformId, string | null>;

const ipOf = (request: Request) =>
  request.headers.get('x-real-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  null;

async function overLimit(kind: Kind, ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const [row] = await db().query(
    `select count(*)::int as n from student_form_events
     where ip = $1 and kind = $2 and at > now() - interval '1 hour'`,
    [ip, kind]
  );
  return Number(row.n) >= LIMITS[kind];
}

async function record(
  kind: Kind,
  ip: string | null,
  email: string,
  studentId: number | null,
  before: Handles | null = null,
  after: Handles | null = null
) {
  await db().query(
    `insert into student_form_events (kind, ip, email, student_id, before, after)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [kind, ip, email, studentId, before && JSON.stringify(before), after && JSON.stringify(after)]
  );
}

/** The student with this email; where two accounts share it, the newer one is in use. */
async function findByEmail(email: string) {
  const [row] = await db().query(
    `select id, name, campus, ${IDS.join(', ')} from students
     where on_platform and (lower(email) = $1 or lower(sunstone_email) = $1)
     order by id desc limit 1`,
    [email]
  );
  if (!row) return null;
  const handles = Object.fromEntries(IDS.map((id) => [id, row[id] ?? null])) as Handles;
  return { id: Number(row.id), name: String(row.name), campus: String(row.campus), handles };
}

const NOT_FOUND = {
  error:
    'We could not find a student with this email. Use the email you gave Sunstone (your personal or Sunstone email).',
};
const TOO_MANY = { error: 'Too many tries from this network. Please try again in an hour.' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Use POST.' });

  let body: { action?: unknown; email?: unknown; handles?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: 'Send JSON.' });
  }
  if (!body || typeof body !== 'object') return json(400, { error: 'Send JSON.' });
  const email = normalizeEmail(String(body.email ?? ''));
  if (!isEmail(email) || email.length > 200) return json(400, { error: 'Enter a valid email.' });
  const ip = ipOf(request);

  if (body.action === 'lookup') {
    if (await overLimit('lookup', ip)) return json(429, TOO_MANY);
    const student = await findByEmail(email);
    await record('lookup', ip, email, student?.id ?? null);
    if (!student) return json(404, NOT_FOUND);
    return json(200, {
      firstName: student.name.split(' ')[0],
      campus: student.campus,
      handles: student.handles,
    });
  }

  if (body.action === 'save') {
    const typed = (body.handles ?? {}) as Record<string, unknown>;
    const handles = {} as Handles;
    const errors: Partial<Record<PlatformId, string>> = {};
    for (const platform of PLATFORMS) {
      const raw = typed[platform.id];
      const check = readHandle(
        platform.id,
        typeof raw === 'string' ? raw.slice(0, 300) : '',
        platform.name
      );
      if (check.ok) handles[platform.id] = check.username;
      else errors[platform.id] = check.error;
    }
    if (Object.keys(errors).length)
      return json(400, { error: 'Fix the usernames marked in red.', errors });
    if (IDS.every((id) => !handles[id])) {
      return json(400, { error: 'Add at least one username.' });
    }

    if (await overLimit('save', ip)) return json(429, TOO_MANY);
    const student = await findByEmail(email);
    if (!student) return json(404, NOT_FOUND);

    await db().query(
      `update students set ${IDS.map((id, index) => `${id} = $${index + 2}`).join(', ')},
         invalid_handles = '{}', form_submitted_at = now(), updated_at = now()
       where id = $1`,
      [student.id, ...IDS.map((id) => handles[id])]
    );
    await record('save', ip, email, student.id, student.handles, handles);
    return json(200, { ok: true, handles });
  }

  return json(400, { error: 'Unknown action.' });
}
