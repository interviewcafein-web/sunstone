// Login without a backend: accounts live in the AUTH_USERS environment variable (username +
// PBKDF2 password hash), and a signed cookie proves who is logged in. Used by middleware.ts
// and the login functions. It imports nothing at runtime, so it works on every runtime.
//
// AUTH_USERS:  "admin:pbkdf2.100000.<salt>.<hash>,sarvesh:pbkdf2...."
//              (dots, not $: env loaders and shells treat $ as the start of a variable)
//              (make entries with: npm run hash-password -- <username> <password>)
// AUTH_SECRET: a long random string that signs the session cookie.

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

export const isConfigured = () => Boolean(process.env.AUTH_SECRET) && accounts().size > 0;

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

/** "<base64url payload>.<base64url signature>", payload = { u: username, e: expiry ms }. */
export async function createSession(username: string) {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ u: username, e: Date.now() + SESSION_DAYS * 86_400_000 }))
  );
  return `${payload}.${toBase64Url(await hmac(payload))}`;
}

/** The logged-in username from the request's cookie, if it is genuine and not expired. */
export async function sessionUser(request: Request): Promise<string | null> {
  if (!isConfigured()) return null;
  const cookie = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!cookie) return null;

  const [payload, signature] = cookie.split('.');
  if (!payload || !signature) return null;
  try {
    if (!sameBytes(await hmac(payload), fromBase64Url(signature))) return null;
    const { u, e } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    // A removed account loses access even with a valid cookie.
    return typeof u === 'string' && e > Date.now() && accounts().has(u) ? u : null;
  } catch {
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
