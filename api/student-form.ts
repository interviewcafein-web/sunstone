// The unlisted student form (/coding-usernames): students give their coding usernames
// without an account. Their email (personal or Sunstone, as in the LMS) finds them, and a
// code sent to it proves it is theirs before they see or change anything.
//
//   POST /api/student-form { action: 'send', email }
//        -> { ok: true }: a 6-digit code is emailed (404 when no student has this email)
//   POST /api/student-form { action: 'verify', email, code }
//        -> { firstName, campus, handles, token }: the usernames saved now, and a token
//           that allows saving for 30 minutes
//   POST /api/student-form { action: 'save', email, token, handles: { leetcode: '…', … } }
//        -> { ok: true, handles }: every username read and checked as the form does, and
//           refused when the account does not exist on its platform
//
// Only the first name and campus are shown, never contact details. Codes last 10 minutes,
// are stored only as an HMAC, allow 5 wrong tries, and are limited to one a minute and five
// an hour per email. Each IP may ask for 20 codes, try 40 and save 10 times an hour. Every
// step is kept in student_form_events (a save with the usernames before and after, so a
// change can be undone). A save marks the form time, so an older Google Form answer synced
// later does not overwrite it.

import { fetchCodingProfile, setRelayOrigin } from '../src/lib/coding-profiles/adapters';
import { readHandle } from '../src/lib/coding-profiles/handles';
import { PLATFORMS } from '../src/lib/coding-profiles/platforms';
import { ProfileError, type PlatformId } from '../src/lib/coding-profiles/types';
import { digest, isEmail, json, newCode, normalizeEmail, sameText } from './_auth';
import { db } from './_db';
import { brevoOnOwnDomain, sendEmail, signInCodeEmail, type ProviderName } from './_email';

export const config = { runtime: 'edge' };

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const CODES_PER_HOUR = 5;
const GAP_SECONDS = 60;
const TOKEN_MINUTES = 30;
/**
 * The provider codes go through first: Brevo once it sends from our own domain
 * (noreply@mail.vertex.sunstone.in), so students use its larger quota and Resend's stays free
 * for staff sign-in; Resend while Brevo still sends from a Gmail address. Either way the other
 * is the backup.
 */
const codesFirstThrough = (): ProviderName => (brevoOnOwnDomain() ? 'Brevo' : 'Resend');
const LIMITS = { send: 20, verify: 40, save: 10 } as const;
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

const codeHash = (email: string, code: string) => digest(`student-form:${email}:${code}`);

/** Proof that this email was verified, good until `expires` (ms): "expires.signature". */
const tokenFor = async (email: string, expires: number) =>
  `${expires}.${await digest(`student-form-token:${email}:${expires}`)}`;

async function validToken(email: string, token: unknown): Promise<boolean> {
  if (typeof token !== 'string') return false;
  const expires = Number(token.split('.')[0]);
  return (
    Number.isFinite(expires) &&
    expires > Date.now() &&
    sameText(token, await tokenFor(email, expires))
  );
}

/**
 * Usernames that do not exist on their platform, as the form checks them. A platform that
 * cannot be asked just now (slow, rate limited) does not block the save.
 */
async function missingAccounts(origin: string, handles: Handles) {
  setRelayOrigin(origin);
  const errors: Partial<Record<PlatformId, string>> = {};
  await Promise.all(
    PLATFORMS.filter((platform) => handles[platform.id]).map(async (platform) => {
      const username = handles[platform.id]!;
      const missing = await Promise.race([
        fetchCodingProfile(platform.id, username).then(
          () => false,
          (error) => error instanceof ProfileError && error.kind === 'not_found'
        ),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10_000)),
      ]);
      if (missing) errors[platform.id] = `No ${platform.name} account is called “${username}”.`;
    })
  );
  return errors;
}

const NOT_FOUND = {
  error:
    'We could not find a student with this email. Use the email you gave Sunstone (your personal or Sunstone email).',
};
const TOO_MANY = { error: 'Too many tries from this network. Please try again in an hour.' };

async function send(ip: string | null, email: string): Promise<Response> {
  if (await overLimit('send', ip)) return json(429, TOO_MANY);
  const student = await findByEmail(email);
  await record('send', ip, email, student?.id ?? null);
  if (!student) return json(404, NOT_FOUND);

  const [recent] = await db().query(
    `select count(*)::int as last_hour,
            coalesce(extract(epoch from now() - max(created_at)), 1e9)::int as seconds_since
     from student_form_codes where email = $1 and created_at > now() - interval '1 hour'`,
    [email]
  );
  if (recent.seconds_since < GAP_SECONDS) {
    return json(429, {
      error: `Please wait ${GAP_SECONDS - recent.seconds_since} seconds before asking for another code.`,
    });
  }
  if (recent.last_hour >= CODES_PER_HOUR) {
    return json(429, { error: 'Too many codes asked for. Try again in an hour.' });
  }

  const code = newCode();
  await db().query(
    `insert into student_form_codes (email, code_hash, expires_at)
     values ($1, $2, now() + make_interval(mins => $3))`,
    [email, await codeHash(email, code), CODE_MINUTES]
  );
  try {
    await sendEmail(
      { to: email, ...signInCodeEmail(code, CODE_MINUTES, 'studentForm') },
      codesFirstThrough()
    );
  } catch (error) {
    console.error('[student-form] code email failed', error);
    await db().query(`delete from student_form_codes where email = $1 and expires_at > now()`, [
      email,
    ]);
    return json(503, {
      error: 'We could not send the code just now. Please try again in a few hours.',
    });
  }
  // Old rows are useless after a day; keep the table small.
  await db().query(`delete from student_form_codes where created_at < now() - interval '1 day'`);
  return json(200, { ok: true });
}

async function verify(ip: string | null, email: string, code: string): Promise<Response> {
  if (await overLimit('verify', ip)) return json(429, TOO_MANY);
  const student = await findByEmail(email);
  await record('verify', ip, email, student?.id ?? null);
  const wrong = () => json(401, { error: 'That code is wrong or has expired.' });
  if (!student || !/^\d{6}$/.test(code)) return wrong();

  const [latest] = await db().query(
    `select id, code_hash, attempts from student_form_codes
     where email = $1 and expires_at > now() order by created_at desc limit 1`,
    [email]
  );
  if (!latest || latest.attempts >= MAX_ATTEMPTS) return wrong();
  if (!sameText(String(latest.code_hash), await codeHash(email, code))) {
    await db().query(`update student_form_codes set attempts = attempts + 1 where id = $1`, [
      latest.id,
    ]);
    return latest.attempts + 1 >= MAX_ATTEMPTS
      ? json(401, { error: 'Too many wrong tries. Ask for a new code.' })
      : wrong();
  }
  await db().query(`delete from student_form_codes where email = $1`, [email]);

  return json(200, {
    firstName: student.name.split(' ')[0],
    campus: student.campus,
    handles: student.handles,
    token: await tokenFor(email, Date.now() + TOKEN_MINUTES * 60_000),
  });
}

async function save(
  origin: string,
  ip: string | null,
  email: string,
  token: unknown,
  typed: Record<string, unknown>
): Promise<Response> {
  if (!(await validToken(email, token))) {
    return json(401, { error: 'This page has been open too long. Ask for a new code to save.' });
  }
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
  if (Object.keys(errors).length) {
    return json(400, { error: 'Fix the usernames marked in red.', errors });
  }
  if (IDS.every((id) => !handles[id])) return json(400, { error: 'Add at least one username.' });
  const missing = await missingAccounts(origin, handles);
  if (Object.keys(missing).length) {
    return json(400, { error: 'Fix the usernames marked in red.', errors: missing });
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

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Use POST.' });

  let body: {
    action?: unknown;
    email?: unknown;
    code?: unknown;
    token?: unknown;
    handles?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: 'Send JSON.' });
  }
  if (!body || typeof body !== 'object') return json(400, { error: 'Send JSON.' });
  const email = normalizeEmail(String(body.email ?? ''));
  if (!isEmail(email) || email.length > 200) return json(400, { error: 'Enter a valid email.' });
  const ip = ipOf(request);

  if (body.action === 'send') return send(ip, email);
  if (body.action === 'verify') return verify(ip, email, String(body.code ?? '').trim());
  if (body.action === 'save') {
    return save(
      new URL(request.url).origin,
      ip,
      email,
      body.token,
      (body.handles ?? {}) as Record<string, unknown>
    );
  }
  return json(400, { error: 'Unknown action.' });
}
