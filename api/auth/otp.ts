// Passwordless sign-in by emailed code, for staff emails (see api/_auth.ts).
//
//   POST /api/auth/otp { action: 'send', email }          -> emails a 6-digit code
//   POST /api/auth/otp { action: 'verify', email, code }  -> sets the session cookie
//   (with client: 'app', the mobile app's sign-in, the session token is also returned in the
//   body, as the app sends it as a Bearer token rather than a cookie)
//
// The reply to 'send' is the same whether or not the email has access, so the form cannot
// be used to find out who is staff. Codes last 10 minutes, are stored only as an HMAC, allow
// 5 wrong tries, and are limited to one a minute and five an hour per email.

import {
  SESSION_DAYS,
  createSession,
  digest,
  emailCodesConfigured,
  isEmail,
  isStaff,
  json,
  normalizeEmail,
  sameText,
  sessionCookie,
} from '../_auth';
import { db } from '../_db';
import { sendEmail, signInCodeEmail } from '../_email';

export const config = { runtime: 'edge' };

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const PER_HOUR = 5;
const GAP_SECONDS = 60;

const SENT = {
  ok: true,
  message: 'If this email has access, a sign-in code is on its way. It expires in 10 minutes.',
};

function newCode(): string {
  // Uniform over 000000-999999: reject the few values that would bias the modulo.
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values);
  while (values[0] >= 4_294_000_000);
  return String(values[0] % 1_000_000).padStart(6, '0');
}

const codeHash = (email: string, code: string) => digest(`otp:${email}:${code}`);

/**
 * App-store reviewers sign in with a fixed code: REVIEW_EMAIL and REVIEW_LOGIN_CODE (6 digits)
 * are set only in Vercel. No email is sent to that address, and the account still has to be
 * active staff (its access is whatever the Team page gives it).
 */
const reviewLogin = (email: string) => {
  const reviewEmail = process.env.REVIEW_EMAIL?.trim().toLowerCase();
  const code = process.env.REVIEW_LOGIN_CODE?.trim();
  return reviewEmail && code && /^\d{6}$/.test(code) && email === reviewEmail ? code : null;
};

async function send(email: string): Promise<Response> {
  if (reviewLogin(email)) return json(200, SENT);
  if (!(await isStaff(email))) {
    // Same answer and roughly the same time as a real send.
    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300));
    return json(200, SENT);
  }

  const [recent] = await db()`
    select count(*)::int as last_hour,
           coalesce(extract(epoch from now() - max(created_at)), 1e9)::int as seconds_since
    from login_codes where email = ${email} and created_at > now() - interval '1 hour'`;
  if (recent.seconds_since < GAP_SECONDS) {
    return json(429, {
      error: `Please wait ${GAP_SECONDS - recent.seconds_since} seconds before asking for another code.`,
    });
  }
  if (recent.last_hour >= PER_HOUR) {
    return json(429, { error: 'Too many codes requested. Try again in an hour.' });
  }

  const code = newCode();
  await db()`
    insert into login_codes (email, code_hash, expires_at)
    values (${email}, ${await codeHash(email, code)}, now() + ${`${CODE_MINUTES} minutes`}::interval)`;
  await sendEmail({ to: email, ...signInCodeEmail(code, CODE_MINUTES) });
  // Old rows are useless after an hour; keep the table small.
  await db()`delete from login_codes where created_at < now() - interval '1 day'`;
  return json(200, SENT);
}

async function verify(
  request: Request,
  email: string,
  code: string,
  app = false
): Promise<Response> {
  const wrong = () => json(401, { error: 'That code is wrong or has expired.' });
  const reviewCode = reviewLogin(email);
  if (reviewCode) {
    if (!sameText(code, reviewCode) || !(await isStaff(email))) return wrong();
    const token = await createSession(email, 'otp');
    return json(200, app ? { user: email, token } : { user: email }, {
      'Set-Cookie': sessionCookie(request, token, SESSION_DAYS * 86_400),
    });
  }
  if (!/^\d{6}$/.test(code)) return wrong();

  const [latest] = await db()`
    select id, code_hash, attempts from login_codes
    where email = ${email} and expires_at > now()
    order by created_at desc limit 1`;
  if (!latest || latest.attempts >= MAX_ATTEMPTS) return wrong();

  if (!sameText(String(latest.code_hash), await codeHash(email, code))) {
    await db()`update login_codes set attempts = attempts + 1 where id = ${latest.id}`;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return latest.attempts + 1 >= MAX_ATTEMPTS
      ? json(401, { error: 'Too many wrong tries. Ask for a new code.' })
      : wrong();
  }

  // Codes are single use, and access may have been removed since the code was sent.
  await db()`delete from login_codes where email = ${email}`;
  if (!(await isStaff(email))) return wrong();
  await db()`update staff set last_login_at = now() where email = ${email}`;

  const token = await createSession(email, 'otp');
  return json(200, app ? { user: email, token } : { user: email }, {
    'Set-Cookie': sessionCookie(request, token, SESSION_DAYS * 86_400),
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!emailCodesConfigured()) {
    return json(503, { error: 'Sign-in by email is not set up yet.' });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    email?: unknown;
    code?: unknown;
    client?: unknown;
  } | null;
  const email = normalizeEmail(typeof body?.email === 'string' ? body.email : '');
  if (!isEmail(email)) return json(400, { error: 'Enter a valid email address.' });

  try {
    if (body?.action === 'send') return await send(email);
    if (body?.action === 'verify') {
      return await verify(
        request,
        email,
        typeof body.code === 'string' ? body.code.trim() : '',
        body.client === 'app'
      );
    }
    return json(400, { error: 'Unknown action' });
  } catch (error) {
    console.error('[otp]', error);
    return json(503, { error: 'Could not complete sign-in. Try again in a minute.' });
  }
}
