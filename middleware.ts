// Converge 2026's addresses (any with "converge" in it) get Converge's page, converge.html,
// instead of Vertex's index.html. Hosts serve index.html for the home page before any rewrite,
// so this runs first. It matters for link previews: WhatsApp and the like read the page's
// HTML without running its code, so they must get Converge's title, description and image.
// Page requests only (the matcher): never the API or files. Vertex's pass straight through.

export const config = {
  matcher: '/((?!api/|assets/|.*\\.[a-zA-Z0-9]+$).*)',
};

export default function middleware(request: Request): Response {
  const host = request.headers.get('host') ?? new URL(request.url).host;
  if (!/converge/i.test(host)) {
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }
  return new Response(null, {
    headers: { 'x-middleware-rewrite': new URL('/converge.html', request.url).toString() },
  });
}
