// Drawing helpers and the card data shape, shared by every share function. The two image
// functions (og.ts, card.ts) run on Vercel's Node.js runtime, where each file is compiled on
// its own, so this file must import nothing at runtime and they import it as './_render.js'.

import type { PlatformId } from '../src/lib/coding-profiles/types';

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
  return lead ? `${lead}. ${tail || 'On Sunstone PRIME Vantage'}` : tail;
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

/**
 * Renders fully before answering. ImageResponse streams, so a rendering error would
 * otherwise go out as an empty 200 image; this returns a 500 with the message instead.
 * The header key is lower-case to replace (not add to) the renderer's one-year cache.
 */
export async function imageResponse(
  render: () => Response,
  headers: Record<string, string>
): Promise<Response> {
  try {
    const png = await render().arrayBuffer();
    return new Response(png, { headers: { 'content-type': 'image/png', ...headers } });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
}

export const notFound = () =>
  new Response(JSON.stringify({ error: 'Student not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
