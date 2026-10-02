import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

import { routeTree } from './routeTree.gen';
import { SUMMARY_QUERY_KEY } from '@/hooks/useStudentSummaries';
import './globals.css';

const DAY = 1000 * 60 * 60 * 24;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Profiles change slowly and the platforms rate-limit, so do not refetch eagerly.
      staleTime: 1000 * 60 * 10,
      // Must outlive the persisted cache below or restored entries are dropped at once.
      gcTime: DAY,
      refetchOnWindowFocus: false,
    },
  },
});

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    // Storage blocked (private mode): run without a persisted cache.
    return undefined;
  }
}

// The table makes a few hundred platform calls. Keeping the results in this browser means
// a reload shows numbers at once and only refetches what has gone stale.
const persister = createSyncStoragePersister({
  storage: browserStorage(),
  key: 'sunstone:query-cache',
});

const router = createRouter({
  routeTree,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root')!;

if (!rootElement.innerHTML) {
  createRoot(rootElement).render(
    <StrictMode>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: DAY,
          buster: 'v1',
          dehydrateOptions: {
            shouldDehydrateQuery: (query) =>
              query.queryKey[0] === SUMMARY_QUERY_KEY && query.state.status === 'success',
          },
        }}
      >
        <RouterProvider router={router} />
      </PersistQueryClientProvider>
    </StrictMode>
  );
  // The intro animation lives in index.html; let it finish and fade once the app has painted.
  requestAnimationFrame(() => window.__hideSplash?.());
}
