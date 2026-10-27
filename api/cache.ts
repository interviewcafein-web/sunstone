// The shared stats cache (table platform_stats). Pages show these saved numbers at once and
// refresh them from the platforms in the background; fresh results are saved back here, so
// the next visitor, on any device, sees them instantly too.
//
//   GET  /api/cache?kind=summaries        saved table summaries for the students the staff
//                                         member may see
//   GET  /api/cache?kind=profiles&s=user  one student's saved profile pages (public for
//                                         students with a public profile, like /api/student)
//   POST /api/cache                       save fresh results (staff only, and only for
//                                         usernames of students they may see, so nobody can
//                                         plant numbers)

import type { PlatformId } from '../src/lib/coding-profiles/types';
import { json, sessionViewer } from './_auth';
import { db } from './_db';
import { findStudent, hasDatabase } from './_roster';

export const config = { runtime: 'edge' };

const PLATFORMS: PlatformId[] = [
  'leetcode',
  'geeksforgeeks',
  'hackerrank',
  'codeforces',
  'codechef',
  'github',
];
const MAX_BODY = 3_000_000;
const MAX_PROFILE = 400_000;

// True when (x.platform, x.handle) is a username of a student on the platform whom the
// viewer may see: $2 is their campus ids, or null for every campus.
const OWNED = `exists (select 1 from students s
  where s.on_platform and ($2::int[] is null or s.campus_id = any($2::int[])) and case x.platform
  ${PLATFORMS.map((platform) => `when '${platform}' then s.${platform}`).join(' ')} end = x.handle)`;

interface Item {
  platform: PlatformId;
  handle: string;
  summary?: unknown;
  profile?: unknown;
}

const validItem = (item: Item) =>
  item &&
  PLATFORMS.includes(item.platform) &&
  typeof item.handle === 'string' &&
  item.handle.length > 0 &&
  item.handle.length <= 100;

async function read(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const viewer = await sessionViewer(request);

  if (url.searchParams.get('kind') === 'summaries') {
    if (!viewer) return json(401, { error: 'Login required' });
    const rows = await db().query(
      `select x.platform, x.handle, x.summary, (extract(epoch from x.summary_at) * 1000)::float8 as at
       from platform_stats x where x.summary is not null and ($1::int[] is null or ${OWNED.replace(/\$2/g, '$1')})`,
      [viewer.campusIds]
    );
    return json(200, { summaries: rows });
  }

  if (url.searchParams.get('kind') === 'profiles') {
    const student = await findStudent(url.searchParams.get('s') ?? '', viewer);
    if (!student) return json(404, { error: 'Student not found' });
    const pairs = PLATFORMS.filter((platform) => student.handles[platform]).map((platform) => [
      platform,
      student.handles[platform],
    ]);
    if (!pairs.length) return json(200, { profiles: [] });
    const rows = await db().query(
      `select p.platform, p.handle, p.profile, (extract(epoch from p.profile_at) * 1000)::float8 as at
       from platform_stats p
       join jsonb_to_recordset($1::jsonb) as x(platform text, handle text)
         on p.platform = x.platform and p.handle = x.handle
       where p.profile is not null`,
      [JSON.stringify(pairs.map(([platform, handle]) => ({ platform, handle })))]
    );
    return json(200, { profiles: rows });
  }

  return json(400, { error: 'Unknown kind' });
}

async function write(request: Request): Promise<Response> {
  const viewer = await sessionViewer(request);
  if (!viewer) return json(401, { error: 'Login required' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'Too large' });

  let body: { summaries?: Item[]; profiles?: Item[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const summaries = (body.summaries ?? []).filter(
    (item) => validItem(item) && item.summary && typeof item.summary === 'object'
  );
  const profiles = (body.profiles ?? []).filter(
    (item) =>
      validItem(item) &&
      item.profile &&
      typeof item.profile === 'object' &&
      JSON.stringify(item.profile).length <= MAX_PROFILE
  );

  let saved = 0;
  if (summaries.length) {
    const result = await db().query(
      `insert into platform_stats (platform, handle, summary, summary_at)
       select x.platform, x.handle, x.summary, now()
       from jsonb_to_recordset($1::jsonb) as x(platform text, handle text, summary jsonb)
       where ${OWNED}
       on conflict (platform, handle)
       do update set summary = excluded.summary, summary_at = excluded.summary_at
       returning 1`,
      [JSON.stringify(summaries), viewer.campusIds]
    );
    saved += result.length;
  }
  if (profiles.length) {
    const result = await db().query(
      `insert into platform_stats (platform, handle, profile, profile_at)
       select x.platform, x.handle, x.profile, now()
       from jsonb_to_recordset($1::jsonb) as x(platform text, handle text, profile jsonb)
       where ${OWNED}
       on conflict (platform, handle)
       do update set profile = excluded.profile, profile_at = excluded.profile_at
       returning 1`,
      [JSON.stringify(profiles), viewer.campusIds]
    );
    saved += result.length;
  }
  return json(200, { saved });
}

export default async function handler(request: Request): Promise<Response> {
  if (!hasDatabase()) return json(404, { error: 'No database configured' });
  try {
    if (request.method === 'GET') return await read(request);
    if (request.method === 'POST') return await write(request);
    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('[cache]', error);
    return json(503, { error: 'The stats cache is unavailable.' });
  }
}
