// Staff login. A signed cookie proves who is logged in; it is made by any of three ways in:
//  - username + password: accounts in the AUTH_USERS environment variable (PBKDF2 hashes);
//  - Google sign-in (api/auth/google*.ts) and emailed one-time codes (api/auth/otp.ts): the
//    email must be an active row in the staff table (npm run staff) or in STAFF_EMAILS.
// Removing a password account or deactivating a staff email ends their access, even with a
// valid cookie. Used by the edge functions only (the Node.js image functions never import it).
//
// AUTH_USERS:   "admin:pbkdf2.100000.<salt>.<hash>,sarvesh:pbkdf2...."
//               (dots, not $: env loaders and shells treat $ as the start of a variable)
//               (make entries with: npm run hash-password -- <username> <password>)
// AUTH_SECRET:  a long random string that signs the session cookie.
// STAFF_EMAILS: optional comma-separated emails allowed in addition to the staff table.

import { db } from './_db';

export const SESSION_COOKIE = 'sunstone_session';
export const SESSION_DAYS = 7;

const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));

/** Compares in constant time, so a wrong guess does not reveal how much of it was right. */
function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

/** username -> stored hash, from AUTH_USERS. */
function accounts(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of (process.env.AUTH_USERS ?? '').split(',')) {
    const separator = entry.indexOf(':');
    if (separator > 0) {
      map.set(entry.slice(0, separator).trim().toLowerCase(), entry.slice(separator + 1).trim());
    }
  }
  return map;
}

/** Password login is available. */
export const isConfigured = () => Boolean(process.env.AUTH_SECRET) && accounts().size > 0;

/** Sessions can be signed at all (needed by every way of logging in). */
export const canSignSessions = () => Boolean(process.env.AUTH_SECRET);

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => EMAIL.test(value);

// Staff lookups are cached briefly per server instance: every API call checks the session,
// and a one-minute delay before a removed staff member loses access is acceptable.
const STAFF_CACHE_MS = 60_000;
const staffCache = new Map<string, { active: boolean; at: number }>();

/** Whether this email may sign in with Google or an emailed code. */
export async function isStaff(email: string): Promise<boolean> {
  const address = normalizeEmail(email);
  const fromEnv = (process.env.STAFF_EMAILS ?? '').split(',').map(normalizeEmail);
  if (fromEnv.includes(address)) return true;
  if (!process.env.DATABASE_URL) return false;

  const cached = staffCache.get(address);
  if (cached && Date.now() - cached.at < STAFF_CACHE_MS) return cached.active;
  const rows = await db()`select 1 from staff where email = ${address} and active`;
  staffCache.set(address, { active: rows.length > 0, at: Date.now() });
  return rows.length > 0;
}

/** The canonical username when the password is right, otherwise null. */
export async function checkPassword(username: string, password: string): Promise<string | null> {
  const name = username.trim().toLowerCase();
  const stored = accounts().get(name);
  // Hash even for unknown users, so the response time does not reveal which names exist.
  const [scheme, rounds, salt, hash] = (
    stored ?? `pbkdf2.100000.${toBase64Url(new Uint8Array(16))}.`
  ).split('.');
  if (scheme !== 'pbkdf2') return null;
  const derived = await pbkdf2(password, fromBase64Url(salt), Number(rounds));
  return stored && sameBytes(derived, fromBase64Url(hash)) ? name : null;
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(process.env.AUTH_SECRET ?? ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

/** Signs a small JSON value: "<base64url payload>.<base64url signature>". */
export async function sign(value: unknown) {
  const payload = toBase64Url(encoder.encode(JSON.stringify(value)));
  return `${payload}.${toBase64Url(await hmac(payload))}`;
}

/** The value inside a `sign`ed token, or null when it was tampered with. */
export async function unsign<T>(token: string | undefined): Promise<T | null> {
  const [payload, signature] = (token ?? '').split('.');
  if (!payload || !signature) return null;
  try {
    if (!sameBytes(await hmac(payload), fromBase64Url(signature))) return null;
    return JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as T;
  } catch {
    return null;
  }
}

/** HMAC of a value as text, for storing secrets (like one-time codes) without the secret. */
export async function digest(value: string) {
  return toBase64Url(await hmac(value));
}

/** Compares two strings in constant time. */
export const sameText = (a: string, b: string) => sameBytes(encoder.encode(a), encoder.encode(b));

interface Session {
  /** Username (password accounts) or email (Google / emailed code). */
  u: string;
  /** Expiry, ms since 1970. */
  e: number;
  /** How they logged in; absent on password sessions made before this existed. */
  m?: 'password' | 'google' | 'otp';
}

/** A session cookie value for a password account (`username`) or a staff email. */
export async function createSession(user: string, method: Session['m'] = 'password') {
  const session: Session = { u: user, e: Date.now() + SESSION_DAYS * 86_400_000, m: method };
  return sign(session);
}

export function readCookie(request: Request, name: string): string | undefined {
  return (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/** The logged-in user (username or staff email) from the request's cookie, if it is genuine,
 *  not expired, and the account still has access. */
export async function sessionUser(request: Request): Promise<string | null> {
  if (!canSignSessions()) return null;
  const session = await unsign<Session>(readCookie(request, SESSION_COOKIE));
  if (!session || typeof session.u !== 'string' || !(session.e > Date.now())) return null;
  try {
    if (session.m === 'google' || session.m === 'otp') {
      return (await isStaff(session.u)) ? session.u : null;
    }
    return accounts().has(session.u) ? session.u : null;
  } catch {
    // The staff list could not be read (database down): treat as logged out, not as an error.
    return null;
  }
}

export function sessionCookie(request: Request, value: string, maxAgeSeconds: number) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
