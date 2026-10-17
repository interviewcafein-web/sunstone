import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

import login from './api/login';
import logout from './api/logout';
import me from './api/me';
import relay from './api/relay';
import student from './api/student';
import students from './api/students';
import gate from './middleware';

type Handler = (request: Request) => Promise<Response>;

// The share-image functions pull in the image renderer, so load them on first use.
const lazy =
  (load: () => Promise<{ default?: Handler; GET?: Handler }>): Handler =>
  async (request) => {
    const module = await load();
    // Node.js-runtime functions export GET; edge functions export a default handler.
    return (module.GET ?? module.default!)(request);
  };

const API_ROUTES: Record<string, Handler> = {
  '/api/login': login,
  '/api/logout': logout,
  '/api/me': me,
  '/api/relay': relay,
  '/api/student': student,
  '/api/students': students,
  '/api/stats': lazy(() => import('./api/stats')),
  '/api/og': lazy(() => import('./api/og')),
  '/api/card': lazy(() => import('./api/card')),
  '/api/share': lazy(() => import('./api/share')),
};

// In production Vercel serves the files in api/ as Edge Functions. Locally there is no
// Vercel, so mount the same handlers on the Vite dev and preview servers.
function toRequest(req: Connect.IncomingMessage, body?: Buffer) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.originalUrl ?? req.url}`, {
    method: req.method,
    headers,
    body: req.method === 'POST' && body ? new Uint8Array(body) : undefined,
  });
}

async function send(res: import('http').ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

// Vite's own module requests during development; never seen on Vercel.
const DEV_INTERNAL = /^\/(@vite|@react-refresh|@id|@fs|src\/|node_modules\/|__)/;

function apiPlugin(): Plugin {
  const mount = (middlewares: Connect.Server) => {
    // The login gate (middleware.ts), as Vercel runs it before everything else.
    middlewares.use(async (req, res, next) => {
      const pathname = (req.originalUrl ?? req.url ?? '/').split('?')[0];
      if (DEV_INTERNAL.test(pathname)) return next();
      const response = await gate(toRequest(req));
      if (response.headers.get('x-middleware-next')) return next();
      await send(res, response);
    });

    for (const [route, handler] of Object.entries(API_ROUTES)) {
      middlewares.use(route, async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);

        let response: Response;
        try {
          response = await handler(toRequest(req, Buffer.concat(chunks)));
        } catch (error) {
          console.error(`[${route}]`, error);
          response = new Response(String(error), { status: 500 });
        }
        await send(res, response);
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
  const env = loadEnv(mode, process.cwd(), ['SHEET_', 'SITE_', 'AUTH_']);
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
