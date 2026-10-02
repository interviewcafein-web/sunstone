import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

import relay from './api/relay';
import students from './api/students';

const API_ROUTES: Record<string, (request: Request) => Promise<Response>> = {
  '/api/relay': relay,
  '/api/students': students,
};

// In production Vercel serves the files in api/ as Edge Functions. Locally there is no
// Vercel, so mount the same handlers on the Vite dev and preview servers.
function apiPlugin(): Plugin {
  const mount = (middlewares: Connect.Server) => {
    for (const [route, handler] of Object.entries(API_ROUTES)) {
      middlewares.use(route, async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);

        const response = await handler(
          new Request(`http://localhost${req.originalUrl ?? req.url}`, {
            method: req.method,
            body: req.method === 'POST' ? new Uint8Array(Buffer.concat(chunks)) : undefined,
          })
        );

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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The api/ handlers read process.env, as they do on Vercel; feed them .env.local in dev.
  Object.assign(process.env, loadEnv(mode, process.cwd(), 'SHEET_'));

  return {
    plugins: [TanStackRouterVite(), react(), tailwindcss(), apiPlugin()],
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
