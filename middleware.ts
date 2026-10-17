// Runs on Vercel before every request (Routing Middleware) and, in development, before the
// Vite dev server (see vite.config.ts). Everything needs a login except the login itself,
// the files the pages need to load, and students' own share links and coding cards.

import { next } from '@vercel/functions';

import { sessionUser } from './api/_auth';

/** Open to everyone: page assets, the login flow, and a student's public link and card. */
const PUBLIC_PREFIXES = ['/assets/', '/fonts/', '/reports/', '/s/'];
const PUBLIC_FILES = /^\/(sunstone-[\w-]+\.png|og-image[\w-]*\.jpg|favicon\.\w+|robots\.txt)$/;
const PUBLIC_PATHS = new Set([
  '/login',
  '/api/login',
  '/api/logout',
  '/api/me',
  // Used by the public profile and card pages, and by link-preview crawlers.
  '/api/student',
  '/api/relay',
  '/api/share',
  '/api/stats',
  '/api/og',
  '/api/card',
]);

export function isPublic(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_FILES.test(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (isPublic(url.pathname) || (await sessionUser(request))) return next();

  // Data requests get a 401 the app can react to; page visits go to the login page and
  // come back afterwards.
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Login required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  const login = new URL('/login', url);
  login.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(login, 302);
}

// Every path; isPublic() decides. Vite's dev-only module paths never reach Vercel.
export const config = { matcher: '/:path*' };
