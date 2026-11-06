// Two sites on one deployment: Vertex (vertex.sunstone.in, tech students) and Converge
// (converge.sunstone.in, or any address with "converge" in it, management students). They
// share this server code; each has its own database (DATABASE_URL and CONVERGE_DATABASE_URL),
// chosen per request by the address it came to. Every endpoint is wrapped in forApp, so db()
// (api/_db.ts) picks the right database for whatever it does. Scripts run outside a request
// and use DATABASE_URL.
//
// Locally, open converge.localhost (browsers send it to this machine) to try Converge.

import { AsyncLocalStorage } from 'node:async_hooks';

export type App = 'vertex' | 'converge';

const current = new AsyncLocalStorage<App>();

/** Which site a request is for, from the address it came to. */
export function appFor(request: Request): App {
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host;
  return /converge/i.test(host) ? 'converge' : 'vertex';
}

/** The site of the request being handled, if this is a request (not a script). */
export const requestApp = (): App | undefined => current.getStore();

/**
 * The site being worked for: the request's, or for a script its school (SCHOOL=SSM is
 * Converge, scripts/_school.ts), so the nightly Converge job builds Converge's pages.
 */
export const currentApp = (): App =>
  current.getStore() ??
  (process.env.SCHOOL?.trim().toUpperCase() === 'SSM' ? 'converge' : 'vertex');

/** Runs an endpoint for the site its request came to. */
export function forApp<Rest extends unknown[]>(
  handler: (request: Request, ...rest: Rest) => Promise<Response>
) {
  return (request: Request, ...rest: Rest) =>
    current.run(appFor(request), () => handler(request, ...rest));
}
