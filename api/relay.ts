// Stateless relay for the coding platforms that refuse browser requests (no CORS headers).
// Deployed by Vercel as an Edge Function at /api/relay; `vite dev` mounts the same handler
// (see vite.config.ts). No database, no secrets: it forwards one allow-listed request.
//
// It is same-origin with the app, so it sends no CORS headers and other sites cannot call
// it from a browser.

export const config = { runtime: 'edge' };

interface Rule {
  host: string;
  path: RegExp;
  method: 'GET' | 'POST';
}

const RULES: Rule[] = [
  { host: 'leetcode.com', path: /^\/graphql\/?$/, method: 'POST' },
  {
    host: 'www.hackerrank.com',
    path: /^\/rest\/(contests\/master\/)?hackers\/[^/]+\/\w+$/,
    method: 'GET',
  },
  { host: 'www.codechef.com', path: /^\/users\/[^/]+$/, method: 'GET' },
  { host: 'github.com', path: /^\/users\/[^/]+\/contributions$/, method: 'GET' },
  { host: 'authapi.geeksforgeeks.org', path: /^\/api-get\/user-profile-info\/$/, method: 'GET' },
  {
    host: 'practiceapi.geeksforgeeks.org',
    path: /^\/api\/v1\/user\/problems\/submissions\/$/,
    method: 'POST',
  },
];

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const MAX_BODY_BYTES = 4096;

// The app checks this header to tell a real relay response from an SPA fallback page.
const RELAY_HEADERS = { 'X-Relay': '1' };

function reply(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...RELAY_HEADERS, 'Content-Type': 'application/json' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  let target: URL;
  try {
    target = new URL(new URL(request.url).searchParams.get('url') ?? '');
  } catch {
    return reply(400, 'Missing or invalid url parameter');
  }

  const allowed = RULES.some(
    (rule) =>
      target.protocol === 'https:' &&
      target.hostname === rule.host &&
      rule.path.test(target.pathname) &&
      request.method === rule.method
  );
  if (!allowed) return reply(403, 'Request not allowed');

  const headers: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
    Referer: `${target.origin}/`,
  };
  let body: string | undefined;
  if (request.method === 'POST') {
    body = await request.text();
    if (body.length > MAX_BODY_BYTES) return reply(413, 'Request body too large');
    headers['Content-Type'] = 'application/json';
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: request.method, headers, body, redirect: 'manual' });
  } catch {
    return reply(502, 'Upstream request failed');
  }

  // These sites redirect unknown users to a landing page; report that as 404.
  if (upstream.status >= 300 && upstream.status < 400) return reply(404, 'Not found');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...RELAY_HEADERS,
      'Content-Type': upstream.headers.get('content-type') ?? 'text/plain',
      'Cache-Control': 'public, max-age=600',
    },
  });
}
