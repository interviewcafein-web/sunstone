// Serves /s/{slug} and /s/{slug}/card (see vercel.json): the normal app page, with the link
// preview tags rewritten for that student. Crawlers (WhatsApp, LinkedIn, X, Slack...) run
// no JavaScript, so this is the only way a shared link can preview the student's own card.

import { cachedStats, describe, findStudent, headline } from './_card';

export const config = { runtime: 'edge' };

const CRAWLER =
  /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|twitter|linkedin|telegram|discord|skype|pinterest|embedly|quora|vkshare|google/i;

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function setMeta(html: string, attribute: 'property' | 'name', key: string, value: string) {
  const pattern = new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`);
  return html.replace(pattern, `$1${escapeAttribute(value)}$2`);
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') ?? '';
  const isCard = url.searchParams.has('card');
  const origin = url.origin;

  let html = await (await fetch(`${origin}/index.html`)).text();
  const student = slug ? await findStudent(origin, slug) : undefined;

  const isCrawler = CRAWLER.test(request.headers.get('user-agent') ?? '');
  if (student) {
    // Only crawlers wait for the (slow, cached) stats; people get the page straight away.
    const stats = isCrawler ? await cachedStats(origin, slug).catch(() => null) : null;
    const title = isCard
      ? `${student.name}'s coding card · Sunstone PRIME`
      : `${student.name} · Sunstone PRIME Coding Profile`;
    const description = stats
      ? describe(stats)
      : headline(student) || 'Coding profile on Sunstone PRIME';
    const page = `${origin}/s/${student.slug}${isCard ? '/card' : ''}`;
    // ?v= changes with the design, so apps that cache previews fetch the new image.
    const image = isCard
      ? `${origin}/api/card?s=${student.slug}&theme=dark&v=1`
      : `${origin}/api/og?s=${student.slug}&v=1`;

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(title)}</title>`);
    html = setMeta(html, 'name', 'description', description);
    for (const [key, value] of [
      ['og:title', title],
      ['og:description', description],
      ['og:url', page],
      ['og:image', image],
      ['og:image:secure_url', image],
      ['og:image:type', 'image/png'],
      ['og:image:width', isCard ? '1080' : '1200'],
      ['og:image:height', isCard ? '1350' : '630'],
      ['og:image:alt', title],
    ]) {
      html = setMeta(html, 'property', key, value);
    }
    for (const [key, value] of [
      ['twitter:title', title],
      ['twitter:description', description],
      ['twitter:image', image],
    ]) {
      html = setMeta(html, 'name', key, value);
    }
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // A crawler's copy (with stats) may be cached and reused for everyone; a person's
      // copy is not, so it never stops a later crawler from seeing the stats.
      'Cache-Control': isCrawler ? 'public, max-age=0, s-maxage=600' : 'no-store',
    },
  });
}
