import { lazy } from 'react';
import { ErrorComponent, createRouter, type ErrorComponentProps } from '@tanstack/react-router';

import { PageLoader } from '@/components/common/PageLoader';

import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import StudentsPage from './pages/StudentsPage';
import {
  campusRoute,
  campusesRoute,
  loginRoute,
  rootRoute,
  routeTree,
  studentRoute,
  studentsRoute,
  superRoute,
} from './routes';

// The pages with charts load on first visit, so the students list does not wait for them.
const StudentPage = lazy(() => import('./pages/StudentPage'));
const CampusesPage = lazy(() => import('./pages/CampusesPage'));
const CampusPage = lazy(() => import('./pages/CampusPage'));
const Super100Page = lazy(() => import('./pages/Super100Page'));

rootRoute.update({ component: Layout });
loginRoute.update({ component: LoginPage });
studentsRoute.update({ component: StudentsPage });
studentRoute.update({ component: StudentPage });
campusesRoute.update({ component: CampusesPage });
campusRoute.update({ component: CampusPage });
superRoute.update({ component: Super100Page });

// After a deploy, a tab opened earlier asks for page files whose names have changed. Reload
// once to pick up the new version instead of showing an error (as Vertex does).
const STALE_BUILD =
  /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i;
const RELOAD_KEY = 'converge:reloaded-for-new-build';

export function reloadForNewBuild(): boolean {
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

function RouteError({ error }: ErrorComponentProps) {
  if (
    STALE_BUILD.test(String(error instanceof Error ? error.message : error)) &&
    reloadForNewBuild()
  ) {
    return <PageLoader variant="plain" label="Updating to the latest version" />;
  }
  return <ErrorComponent error={error} />;
}

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultErrorComponent: RouteError,
  defaultPendingComponent: () => <PageLoader variant="plain" label="Loading" />,
});
