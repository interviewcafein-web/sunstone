import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

import relay from './api/relay';
import students from './api/students';

type Handler = (request: Request) => Promise<Response>;

// The share-image functions pull in the image renderer, so load them on first use.
const lazy =
  (load: () => Promise<{ default: Handler }>): Handler =>
  async (request) =>
    (await load()).default(request);

const API_ROUTES: Record<string, Handler> = {
  '/api/relay': relay,
  '/api/students': students,
  '/api/stats': lazy(() => import('./api/stats')),
  '/api/og': lazy(() => import('./api/og')),
  '/api/card': lazy(() => import('./api/card')),
  '/api/share': lazy(() => import('./api/share')),
};

// In production Vercel serves the files in api/ as Edge Functions. Locally there is no
// Vercel, so mount the same handlers on the Vite dev and preview servers.
function apiPlugin(): Plugin {
  const mount = (middlewares: Connect.Server) => {
    for (const [route, handler] of Object.entries(API_ROUTES)) {
      middlewares.use(route, async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);

        let response: Response;
        try {
          response = await handler(
            new Request(`http://${req.headers.host ?? 'localhost'}${req.originalUrl ?? req.url}`, {
              method: req.method,
              headers: { 'user-agent': req.headers['user-agent'] ?? '' },
              body: req.method === 'POST' ? new Uint8Array(Buffer.concat(chunks)) : undefined,
            })
          );
        } catch (error) {
          console.error(`[${route}]`, error);
          response = new Response(String(error), { status: 500 });
        }

        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
    }
  };

  return {
    name: 'sunstone-api',
    configureServer: (server) => mount(server.middlewares),
    configurePreviewServer: (server) => mount(server.middlewares),
  };
}

// Link-preview crawlers need absolute URLs. SITE_URL wins; otherwise use the production
// domain Vercel provides at build time, so previews work without any configuration.
function siteUrlPlugin(siteUrl: string): Plugin {
  return {
    name: 'sunstone-site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl),
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The api/ handlers read process.env, as they do on Vercel; feed them .env.local in dev.
  const env = loadEnv(mode, process.cwd(), ['SHEET_', 'SITE_']);
  Object.assign(process.env, env);

  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const siteUrl = (
    env.SITE_URL || (vercelDomain ? `https://${vercelDomain}` : 'http://localhost:3002')
  ).replace(/\/+$/, '');

  return {
    plugins: [TanStackRouterVite(), react(), tailwindcss(), apiPlugin(), siteUrlPlugin(siteUrl)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'tanstack-vendor': ['@tanstack/react-router', '@tanstack/react-query'],
          },
        },
      },
    },
    server: {
      // InterviewCafe frontend owns 3000 and UpCurve 3001; Sunstone sits next to them.
      port: 3002,
      host: true,
    },
  };
});
