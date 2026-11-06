// Converge (converge.sunstone.in): Sunstone PRIME's management students (BBA, MBA).
// A second site on the same deployment as Vertex: converge.html loads this file, and the
// shared api/ answers from the Converge database for converge.* addresses (api/_app.ts).

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LoaderMark } from '@/components/common/PageLoader';
import { THEME_KEY, setTheme, useTheme } from '@/lib/theme';
import { reloadForNewBuild, router } from './router';
import '../globals.css';

// Converge's own colours (src/globals.css), also when this page is opened as converge.html.
document.documentElement.classList.add('converge');

// The saved theme (shared with Vertex's toggle), before the first paint.
try {
  if (localStorage.getItem(THEME_KEY) === 'dark') setTheme('dark');
} catch {
  // Storage blocked: light theme.
}

// Vertex holds page entrances and counters until its intro animation has gone; Converge has
// no intro, so they start at once.
document.documentElement.classList.add('splash-gone');

window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewBuild()) event.preventDefault();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
    },
  },
});

/** The Converge figure in the loading pill: navy on the light theme, white on the dark one. */
function App() {
  const theme = useTheme();
  return (
    <LoaderMark.Provider
      value={theme === 'dark' ? '/converge-mark-white.png' : '/converge-mark-ink.png'}
    >
      <RouterProvider router={router} />
    </LoaderMark.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
