// GET /api/og?s={slug}: the 1200x630 link-preview image for one student, in the style of
// InterviewCafe's profile preview: initials, name, campus, headline numbers and a chip per
// platform with its count.

import { ImageResponse } from '@vercel/og';

import { LOGO_DATA } from './_logos.js';
import {
  cacheFor,
  cachedStats,
  formatNumber,
  h,
  headline,
  imageResponse,
  initials,
  loadFonts,
  notFound,
} from './_render.js';

const NAVY = '#1a3e70';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const GOLD = '#d97706';

// Node.js runtime: the image renderer needs WebAssembly, which Vercel's edge runtime
// refuses to compile outside Next.js.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const stats = await cachedStats(url.origin, url.searchParams.get('s') ?? '');
  if (!stats) return notFound();

  const tiles = [
    { label: 'Problems solved', value: formatNumber(stats.solved) },
    { label: 'Active days', value: formatNumber(stats.activeDays) },
    stats.contests ? { label: 'Contests', value: formatNumber(stats.contests) } : null,
    stats.topRating
      ? { label: `${stats.topRating.platform} rating`, value: formatNumber(stats.topRating.value) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const image = h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '56px 72px',
        background: '#f8fafc',
        fontFamily: 'Inter',
        position: 'relative',
      },
    },
    h('div', {
      style: {
        position: 'absolute',
        top: -260,
        right: -200,
        width: 620,
        height: 620,
        borderRadius: 9999,
        background: '#dae5f3',
      },
    }),
    // Brand
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' } },
      h('img', { src: `${url.origin}/sunstone-logo.png`, width: 262, height: 34 }),
      h(
        'div',
        {
          style: {
            display: 'flex',
            marginTop: 6,
            marginLeft: 56,
            color: GOLD,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 8,
          },
        },
        'PRIME'
      )
    ),
    // Person
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', marginTop: 40 } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            width: 132,
            height: 132,
            borderRadius: 9999,
            background: NAVY,
            color: 'white',
            fontSize: 52,
            fontWeight: 700,
            alignItems: 'center',
            justifyContent: 'center',
            border: '6px solid #fbbf24',
          },
        },
        initials(stats.name)
      ),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', marginLeft: 36, maxWidth: 820 } },
        h(
          'div',
          { style: { fontSize: 54, fontWeight: 800, color: INK, lineHeight: 1.1 } },
          stats.name
        ),
        h(
          'div',
          { style: { fontSize: 26, color: MUTED, marginTop: 10 } },
          headline(stats) || 'Coding profile'
        ),
        h(
          'div',
          { style: { fontSize: 22, color: NAVY, fontWeight: 600, marginTop: 8 } },
          'On Sunstone PRIME Vertex'
        )
      )
    ),
    // Numbers
    h(
      'div',
      { style: { display: 'flex', marginTop: 40 } },
      ...tiles.map((tile, index) =>
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              marginLeft: index ? 20 : 0,
              padding: '20px 26px',
              background: 'white',
              border: `2px solid ${LINE}`,
              borderRadius: 20,
            },
          },
          h('div', { style: { fontSize: 46, fontWeight: 700, color: INK } }, tile.value),
          h('div', { style: { fontSize: 20, color: MUTED, marginTop: 4 } }, tile.label)
        )
      )
    ),
    // Platforms
    h(
      'div',
      { style: { display: 'flex', flexWrap: 'wrap', marginTop: 28 } },
      ...stats.platforms.map((platform) =>
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              padding: '10px 20px 10px 14px',
              marginRight: 12,
              marginBottom: 12,
              background: 'white',
              border: `2px solid ${LINE}`,
              borderRadius: 9999,
              fontSize: 21,
              fontWeight: 600,
              color: INK,
            },
          },
          h('img', {
            src: LOGO_DATA[platform.id],
            width: 26,
            height: 26,
            style: { marginRight: 10 },
          }),
          `${platform.name}${platform.value !== null ? ` ${formatNumber(platform.value)}` : ''}`
        )
      )
    )
  );

  const fonts = await loadFonts(url.origin);
  return imageResponse(
    () => new ImageResponse(image as never, { width: 1200, height: 630, fonts }),
    { 'cache-control': cacheFor(stats) }
  );
}
