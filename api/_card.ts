// Shared by the share functions (stats, og, card, share): look a student up by slug and
// work out the numbers their link preview and coding card show. Mirrors InterviewCafe's
// backend/app/users/services/profile_card.py. The leading underscore keeps Vercel from
// treating this file as an endpoint.

import { mergeCalendars, streaksOf } from '../src/lib/coding-profiles/activity';
import { fetchCodingProfile, setRelayOrigin } from '../src/lib/coding-profiles/adapters';
import { PLATFORMS } from '../src/lib/coding-profiles/platforms';
import type { PlatformId } from '../src/lib/coding-profiles/types';
import type { Student, StudentsResponse } from '../src/lib/students/types';

export interface CardStats {
  slug: string;
  name: string;
  campus: string;
  batch: string;
  course: string;
  solved: number;
  contests: number;
  activeDays: number;
  topRating: { platform: string; value: number } | null;
  /** Current contest rating per rated platform (LeetCode, Codeforces, CodeChef). */
  ratings: { id: PlatformId; name: string; value: number }[];
  /** True when a linked platform failed to load (rate limit, outage), so totals are low. */
  incomplete: boolean;
  /** Every platform that loaded, in the app's order; value is contributions for GitHub. */
  platforms: { id: PlatformId; name: string; color: string; value: number | null }[];
}

export async function findStudent(origin: string, slug: string): Promise<Student | undefined> {
  const response = await fetch(`${origin}/api/students`);
  if (!response.ok) return undefined;
  const body = (await response.json()) as StudentsResponse;
  return body.students.find((student) => student.slug === slug);
}

export async function cardStats(origin: string, student: Student): Promise<CardStats> {
  setRelayOrigin(origin);
  const linked = PLATFORMS.filter((platform) => student.handles[platform.id]);
  const results = await Promise.allSettled(
    linked.map((platform) => fetchCodingProfile(platform.id, student.handles[platform.id]!))
  );
  const profiles = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  );

  let topRating: CardStats['topRating'] = null;
  for (const profile of profiles) {
    const current = profile.rating?.current;
    if (current && (!topRating || current > topRating.value)) {
      topRating = {
        platform: PLATFORMS.find((platform) => platform.id === profile.platform)!.name,
        value: current,
      };
    }
  }

  return {
    slug: student.slug,
    name: student.name,
    campus: student.campus,
    batch: student.batch,
    course: student.course,
    solved: profiles.reduce((sum, profile) => sum + (profile.solved ?? 0), 0),
    contests: profiles.reduce((sum, profile) => sum + (profile.rating?.contests ?? 0), 0),
    activeDays: streaksOf(mergeCalendars(profiles.map((profile) => profile.calendar))).activeDays,
    topRating,
    incomplete: results.some(
      (result) =>
        result.status === 'rejected' &&
        (result.reason as { kind?: string } | undefined)?.kind !== 'not_found'
    ),
    ratings: profiles.flatMap((profile) =>
      profile.rating?.current
        ? [
            {
              id: profile.platform,
              name: PLATFORMS.find((platform) => platform.id === profile.platform)!.name,
              value: profile.rating.current,
            },
          ]
        : []
    ),
    platforms: profiles.map((profile) => {
      const platform = PLATFORMS.find((item) => item.id === profile.platform)!;
      const contributions = profile.kpis[0]?.value;
      return {
        id: platform.id,
        name: platform.name,
        color: platform.color,
        value: profile.solved ?? (typeof contributions === 'number' ? contributions : null),
      };
    }),
  };
}

/** The stats endpoint is CDN-cached, so every image and preview reads through it. */
export async function cachedStats(origin: string, slug: string): Promise<CardStats | null> {
  const response = await fetch(`${origin}/api/stats?s=${encodeURIComponent(slug)}`);
  return response.ok ? ((await response.json()) as CardStats) : null;
}

/** Long cache for complete numbers; five minutes when a platform failed, so it retries soon. */
export const cacheFor = (stats: Pick<CardStats, 'incomplete'>) =>
  stats.incomplete
    ? 'public, max-age=0, s-maxage=300'
    : 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400';

export const formatNumber = (value: number) => value.toLocaleString('en-IN');

/** "312 problems solved · 42 contests · LeetCode rating 1,700. SAGE University, Indore" */
export function describe(stats: CardStats): string {
  const parts: string[] = [];
  if (stats.solved) parts.push(`${formatNumber(stats.solved)} problems solved`);
  if (stats.contests) parts.push(`${formatNumber(stats.contests)} contests`);
  if (stats.topRating) {
    parts.push(`${stats.topRating.platform} rating ${formatNumber(stats.topRating.value)}`);
  }
  const tail = [
    stats.campus,
    stats.batch && stats.batch !== 'Not specified' ? `Batch ${stats.batch}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const lead = parts.join(' · ');
  return lead ? `${lead}. ${tail || 'Coding profile on Sunstone PRIME'}` : tail;
}

export const headline = (stats: Pick<CardStats, 'campus' | 'batch'>) =>
  [stats.campus, stats.batch && stats.batch !== 'Not specified' ? `Batch ${stats.batch}` : '']
    .filter(Boolean)
    .join(' · ');

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

// --------------------------------------------------------------- rendering

type Child = Node | string | number | null | false | undefined;
export interface Node {
  type: string;
  props: Record<string, unknown> & { children?: Child | Child[] };
}

/** Minimal element factory for @vercel/og, so the image functions need no JSX setup. */
export function h(type: string, props: Record<string, unknown> | null, ...children: Child[]): Node {
  const kids = children
    .flat()
    .filter((child) => child !== null && child !== false && child !== undefined);
  // The renderer rejects a div with several children unless it is a flex box, and counts an
  // empty child list as several, so leave `children` out when there are none.
  const style = (props?.style ?? {}) as Record<string, unknown>;
  const fixed =
    type === 'div' && kids.length > 1 && !style.display ? { ...style, display: 'flex' } : style;
  const node: Node = { type, props: { ...(props ?? {}), style: fixed } };
  if (kids.length) node.props.children = kids.length === 1 ? kids[0] : kids;
  return node;
}

export async function loadFonts(origin: string) {
  const weights = [400, 600, 700, 800] as const;
  return Promise.all(
    weights.map(async (weight) => ({
      name: 'Inter',
      data: await (await fetch(`${origin}/fonts/inter-${weight}.woff`)).arrayBuffer(),
      weight,
      style: 'normal' as const,
    }))
  );
}

export const notFound = () =>
  new Response(JSON.stringify({ error: 'Student not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
