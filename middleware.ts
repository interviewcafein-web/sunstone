// Converge 2026's addresses (any with "converge" in it) get Converge's page, converge.html,
// instead of Vertex's index.html. Hosts serve index.html for the home page before any rewrite,
// so this runs first. It matters for link previews: WhatsApp and the like read the page's
// HTML without running its code, so they must get Converge's title, description and image.
// Runs only for Converge's page requests (the matcher), never for Vertex, the API or files.

export const config = {
  matcher: [
    {
      source: '/((?!api/|assets/|.*\\.[a-zA-Z0-9]+$).*)',
      has: [{ type: 'host', value: '(?<host>.*converge.*)' }],
    },
  ],
};

export default function middleware(request: Request): Response {
  return new Response(null, {
    headers: { 'x-middleware-rewrite': new URL('/converge.html', request.url).toString() },
  });
}
