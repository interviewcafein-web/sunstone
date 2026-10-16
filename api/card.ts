// GET /api/card?s={slug}&theme=dark|light&download=1: the shareable portrait "coding card",
// laid out like InterviewCafe's (brand, avatar on rings, name, stat panels, platforms, URL).

import { ImageResponse } from '@vercel/og';

import { LOGO_DATA } from './_logos';
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
} from './_card';

export const config = { runtime: 'edge' };

const THEMES = {
  dark: {
    background: 'linear-gradient(180deg, #1d4378 0%, #0d1f3c 45%, #0a172e 100%)',
    text: '#ffffff',
    muted: '#9fb4d3',
    panel: 'rgba(255,255,255,0.06)',
    edge: 'rgba(255,255,255,0.14)',
    faint: 'rgba(255,255,255,0.07)',
    pill: 'rgba(255,255,255,0.10)',
    logo: 'sunstone-logo-white.png',
    accents: ['#fbbf24', '#7dd3fc', '#6ee7b7'],
  },
  light: {
    background: 'linear-gradient(180deg, #dae5f3 0%, #f8fafc 45%, #ffffff 100%)',
    text: '#0f172a',
    muted: '#64748b',
    panel: '#ffffff',
    edge: '#e2e8f0',
    faint: 'rgba(26,62,112,0.08)',
    pill: '#f1f5f9',
    logo: 'sunstone-logo.png',
    accents: ['#d97706', '#0284c7', '#059669'],
  },
};

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get('s') ?? '';
  const stats = await cachedStats(url.origin, slug);
  if (!stats) return notFound();
  const theme = THEMES[url.searchParams.get('theme') === 'light' ? 'light' : 'dark'];

  const panels = [
    { label: 'Problems solved', value: formatNumber(stats.solved) },
    { label: 'Active days', value: formatNumber(stats.activeDays) },
    stats.contests ? { label: 'Contests', value: formatNumber(stats.contests) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const panel = (title: string, children: ReturnType<typeof h>[]) =>
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 24,
          padding: '26px 32px 18px',
          background: theme.panel,
          border: `2px solid ${theme.edge}`,
          borderRadius: 24,
        },
      },
      h('div', { style: { fontSize: 26, fontWeight: 600, color: theme.muted } }, title),
      h(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 } },
        ...children
      )
    );

  const pill = (id: (typeof stats.platforms)[number]['id'], text: string) =>
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          padding: '10px 22px 10px 12px',
          margin: '0 6px 12px',
          background: theme.pill,
          borderRadius: 9999,
          fontSize: 25,
          fontWeight: 600,
          color: theme.text,
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            width: 38,
            height: 38,
            borderRadius: 9999,
            background: 'white',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          },
        },
        h('img', { src: LOGO_DATA[id], width: 24, height: 24 })
      ),
      text
    );

  const host = url.host.replace(/^www\./, '');
  const image = h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '52px 64px 40px',
        backgroundImage: theme.background,
        fontFamily: 'Inter',
        color: theme.text,
        position: 'relative',
      },
    },
    // Rings and cross lines behind the avatar
    ...[220, 360, 520].map((radius) =>
      h('div', {
        style: {
          position: 'absolute',
          left: 540 - radius,
          top: 330 - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: 9999,
          border: `2px solid ${theme.faint}`,
        },
      })
    ),
    h('div', {
      style: {
        position: 'absolute',
        left: 0,
        top: 329,
        width: 1080,
        height: 2,
        background: theme.faint,
      },
    }),
    // Brand
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' } },
      h('img', { src: `${url.origin}/${theme.logo}`, width: 277, height: 36 }),
      h(
        'div',
        {
          style: {
            display: 'flex',
            marginTop: 12,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 9,
            color: theme.muted,
          },
        },
        h(
          'span',
          { style: { color: theme.accents[0], fontWeight: 800, marginRight: 18 } },
          'PRIME'
        ),
        'CODING CARD'
      )
    ),
    // Avatar
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'center', marginTop: 34 } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            width: 236,
            height: 236,
            borderRadius: 9999,
            background: 'linear-gradient(135deg, #3863a0, #102646)',
            border: `10px solid ${theme.accents[0]}`,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 92,
            fontWeight: 800,
            color: 'white',
          },
        },
        initials(stats.name)
      )
    ),
    // Name + campus pill
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'center',
          marginTop: 30,
          fontSize: 60,
          fontWeight: 800,
          textAlign: 'center',
        },
      },
      stats.name
    ),
    headline(stats)
      ? h(
          'div',
          { style: { display: 'flex', justifyContent: 'center', marginTop: 16 } },
          h(
            'div',
            {
              style: {
                display: 'flex',
                padding: '10px 28px',
                borderRadius: 9999,
                background: theme.pill,
                fontSize: 25,
                fontWeight: 600,
                color: theme.muted,
              },
            },
            headline(stats)
          )
        )
      : null,
    // Numbers
    h(
      'div',
      { style: { display: 'flex', marginTop: 36 } },
      ...panels.map((item, index) =>
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              marginLeft: index ? 20 : 0,
              padding: '24px 16px',
              background: theme.panel,
              border: `2px solid ${theme.edge}`,
              borderRadius: 24,
            },
          },
          h(
            'div',
            { style: { fontSize: 25, fontWeight: 600, color: theme.accents[index] } },
            item.label
          ),
          h('div', {
            style: { width: '80%', height: 2, background: theme.edge, margin: '18px 0 12px' },
          }),
          h('div', { style: { fontSize: 60, fontWeight: 800 } }, item.value)
        )
      )
    ),
    stats.platforms.length
      ? panel(
          'You can find me on',
          stats.platforms.map((platform) =>
            pill(
              platform.id,
              `${platform.name}${platform.value !== null ? ` · ${formatNumber(platform.value)}` : ''}`
            )
          )
        )
      : null,
    stats.ratings.length
      ? panel(
          'Contest ratings',
          stats.ratings.map((rating) =>
            pill(rating.id, `${rating.name} · ${formatNumber(rating.value)}`)
          )
        )
      : null,
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'center',
          marginTop: 'auto',
          fontSize: 24,
          color: theme.muted,
        },
      },
      `${host}/s/${stats.slug}`
    )
  );

  const headers: Record<string, string> = {
    'cache-control': cacheFor(stats),
  };
  if (url.searchParams.get('download')) {
    const name = stats.name.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim() || stats.slug;
    const file = `${name} - Sunstone PRIME Coding Card.png`;
    const ascii = file.replace(/[^\x20-\x7e]/g, '').trim() || 'Sunstone PRIME Coding Card.png';
    headers['content-disposition'] =
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file)}`;
  }

  const fonts = await loadFonts(url.origin);
  return imageResponse(
    () => new ImageResponse(image as never, { width: 1080, height: 1350, fonts }),
    headers
  );
}
