import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ErrorComponent,
  createRouter,
  RouterProvider,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

import { routeTree } from './routeTree.gen';
import { PageLoader } from '@/components/common/PageLoader';
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

// After a deploy, a tab opened earlier asks for page files whose names have changed and no
// longer exist. Reload once to pick up the new version instead of showing an error; the
// guard stops a reload loop if the file is missing for some other reason.
const STALE_BUILD =
  /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i;
const RELOAD_KEY = 'vertex:reloaded-for-new-build';

function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage blocked: still reload, at most this once per page.
  }
  window.location.reload();
  return true;
}

window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewBuild()) event.preventDefault();
});

function RouteError({ error }: ErrorComponentProps) {
  if (
    STALE_BUILD.test(String(error instanceof Error ? error.message : error)) &&
    reloadForNewBuild()
  ) {
    return <PageLoader variant="plain" label="Updating to the latest version" />;
  }
  return <ErrorComponent error={error} />;
}

const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultErrorComponent: RouteError,
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
          buster: 'v2',
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
