// Staff login. A signed cookie proves who is logged in. Staff sign in without a password:
// with Google (api/auth/google*.ts) or an emailed one-time code (api/auth/otp.ts); the email
// must be an active row in the staff table (npm run staff) or in STAFF_EMAILS. Deactivating
// a staff email ends their access, even with a valid cookie. Used by the edge functions only
// (the Node.js image functions never import it).
//
// Username + password (AUTH_USERS) is only the bootstrap: it works until Google or emailed
// codes are configured AND at least one staff email exists. From then on password sign-in is
// refused and password sessions stop working, so AUTH_USERS can be deleted.
//
// AUTH_USERS:   "admin:pbkdf2.100000.<salt>.<hash>,sarvesh:pbkdf2...."
//               (dots, not $: env loaders and shells treat $ as the start of a variable)
//               (make entries with: npm run hash-password -- <username> <password>)
// AUTH_SECRET:  a long random string that signs the session cookie.
// STAFF_EMAILS: optional comma-separated emails allowed in addition to the staff table.

import { db } from './_db';
import { canSendEmail } from './_email';
import { googleConfigured } from './auth/_google';

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

/** Sessions can be signed at all (needed by every way of logging in). */
export const canSignSessions = () => Boolean(process.env.AUTH_SECRET);

/** Emailed sign-in codes can be sent (locally they are printed instead; see _email.ts). */
export const emailCodesConfigured = () =>
  canSignSessions() && Boolean(process.env.DATABASE_URL) && canSendEmail();

export const googleSignInConfigured = () => canSignSessions() && googleConfigured();

/**
 * Whether username + password sign-in still works: only until Google or emailed codes are set
 * up. A built-in super admin (BUILT_IN_SUPER_ADMINS) always exists, so someone can always
 * sign in once passwords are off.
 */
export async function passwordLoginEnabled(): Promise<boolean> {
  return (
    canSignSessions() && accounts().size > 0 && !googleSignInConfigured() && !emailCodesConfigured()
  );
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => EMAIL.test(value);

// --- Roles -----------------------------------------------------------------------------
//   super_admin  every campus; manages HQ and campus staff. Built in, see below.
//   hq           every campus; manages HQ and campus staff (not super admins).
//   campus       only the campuses in its campus_ids; manages nobody.

export type Role = 'super_admin' | 'hq' | 'campus';

/** Always super admins, whatever the staff table says; they cannot be removed in the app. */
export const BUILT_IN_SUPER_ADMINS = ['93mishra@gmail.com'];

export interface StaffAccess {
  role: Role;
  name: string | null;
  /** Google profile photo (staff who signed in with Google). */
  picture: string | null;
  /** LMS campus ids (students.campus_id); used only for the campus role. */
  campusIds: number[];
}

// Staff lookups are cached briefly per server instance: every API call checks the session,
// and a one-minute delay before a change of access takes effect is acceptable.
const STAFF_CACHE_MS = 60_000;
const staffCache = new Map<string, { access: StaffAccess | null; at: number }>();

/** Forget cached access (after the team page changes someone). */
export const forgetStaff = (email: string) => staffCache.delete(normalizeEmail(email));

/** What this email may do, or null when it has no access. */
export async function staffAccess(email: string): Promise<StaffAccess | null> {
  const address = normalizeEmail(email);
  const cached = staffCache.get(address);
  if (cached && Date.now() - cached.at < STAFF_CACHE_MS) return cached.access;

  let access: StaffAccess | null = null;
  if (process.env.DATABASE_URL) {
    const [row] = await db()`
      select name, role, campus_ids, picture from staff where email = ${address} and active`;
    if (row) {
      access = {
        role: row.role as Role,
        name: row.name ? String(row.name) : null,
        picture: row.picture ? String(row.picture) : null,
        campusIds: (row.campus_ids as number[]) ?? [],
      };
    }
  }
  if (BUILT_IN_SUPER_ADMINS.includes(address)) {
    access = {
      role: 'super_admin',
      name: access?.name ?? null,
      picture: access?.picture ?? null,
      campusIds: [],
    };
  } else if (
    !access &&
    (process.env.STAFF_EMAILS ?? '').split(',').map(normalizeEmail).includes(address)
  ) {
    access = { role: 'hq', name: null, picture: null, campusIds: [] };
  }
  staffCache.set(address, { access, at: Date.now() });
  return access;
}

/** Whether this email may sign in with Google or an emailed code. */
export const isStaff = async (email: string) => Boolean(await staffAccess(email));

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

/** Who is signed in, and what they may see. */
export interface Viewer {
  /** Username (password accounts) or email. */
  user: string;
  name: string | null;
  picture: string | null;
  role: Role;
  /** The campuses they may see; null means every campus. */
  campusIds: number[] | null;
}

/** The signed-in person from the request's cookie, if it is genuine, not expired, and the
 *  account still has access. Password accounts (the bootstrap logins) count as HQ. */
export async function sessionViewer(request: Request): Promise<Viewer | null> {
  if (!canSignSessions()) return null;
  const session = await unsign<Session>(readCookie(request, SESSION_COOKIE));
  if (!session || typeof session.u !== 'string' || !(session.e > Date.now())) return null;
  try {
    if (session.m === 'google' || session.m === 'otp') {
      const access = await staffAccess(session.u);
      if (!access) return null;
      return {
        user: session.u,
        name: access.name,
        picture: access.picture,
        role: access.role,
        campusIds: access.role === 'campus' ? access.campusIds : null,
      };
    }
    if (accounts().has(session.u) && (await passwordLoginEnabled())) {
      return { user: session.u, name: null, picture: null, role: 'hq', campusIds: null };
    }
    return null;
  } catch {
    // The staff list could not be read (database down): treat as logged out, not as an error.
    return null;
  }
}

/** The signed-in username or email, for endpoints that only need "is this staff". */
export async function sessionUser(request: Request): Promise<string | null> {
  return (await sessionViewer(request))?.user ?? null;
}

/** Super admins and HQ manage the team. */
export const managesTeam = (viewer: Viewer | null) =>
  viewer?.role === 'super_admin' || viewer?.role === 'hq';

/** Whether the viewer may see students of this campus. */
export const seesCampus = (viewer: Viewer, campusId: number | null) =>
  viewer.campusIds === null || (campusId !== null && viewer.campusIds.includes(campusId));

export function sessionCookie(request: Request, value: string, maxAgeSeconds: number) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
