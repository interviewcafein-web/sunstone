// GET /api/stats?s={slug}: the numbers behind one student's link preview and coding card.
// Fetching six platforms is slow, so the result is cached at the edge for six hours and
// served stale for a day while it refreshes (five minutes if a platform failed to load).

import { cacheFor, cardStats, findStudent, notFound } from './_card';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get('s') ?? '';
  const student = slug ? await findStudent(url.origin, slug) : undefined;
  if (!student) return notFound();

  const stats = await cardStats(url.origin, student);
  return new Response(JSON.stringify(stats), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheFor(stats).replace('max-age=3600', 'max-age=0'),
    },
  });
}
