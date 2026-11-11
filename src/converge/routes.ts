// Converge's pages, as code-based TanStack Router routes. Vertex has its own file-based
// route tree (src/routes, src/routeTree.gen.ts); Converge does not use it. The pages are
// attached in router.tsx, so the pages can import these routes without an import cycle.

import { createRootRoute, createRoute } from '@tanstack/react-router';

import { validateIssuesSearch } from '@/lib/issuesSearch';
import { validatePlacementsSearch } from '@/lib/placements';

import type { SortKey } from './lib/rows';

const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim() || undefined
    : undefined;

const positive = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

const SORT_KEYS: SortKey[] = ['name', 'domain', 'elq', 'amcat', 'attendance', 'exams'];
const sortOf = (value: unknown) => {
  const sort = text(value);
  return SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : undefined;
};

/** Program and admission year ("BBA:2025"), a whole program ("BBA:") or a year ("2025"). */
const BATCH = /^(\d{4}|[A-Za-z. ]{2,20}:(\d{4})?)$/;
const batchOf = (value: unknown) => {
  const batch = text(value);
  return batch && BATCH.test(batch) ? batch : undefined;
};

export const rootRoute = createRootRoute();

export interface LoginSearch {
  /** Where to go after signing in; only paths on this site are honoured. */
  next?: string;
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const next = typeof search.next === 'string' ? search.next : undefined;
    return { next: next && next.startsWith('/') && !next.startsWith('//') ? next : undefined };
  },
});

export interface StudentsSearch {
  campus?: string;
  /** BBA or MBA. */
  program?: string;
  /** "BBA:2025" (a cohort) or "2025". */
  batch?: string;
  /** An LMS opportunity cohort, e.g. "Cohort C". */
  cohort?: string;
  q?: string;
  /** Super 100 students only. */
  super?: boolean;
  sort?: SortKey;
}

const studentsSearch = (search: Record<string, unknown>): StudentsSearch => ({
  campus: text(search.campus),
  program: text(search.program),
  batch: batchOf(search.batch),
  cohort: text(search.cohort),
  // Not trimmed: this is bound to the search box, and trimming would eat typed spaces.
  q: search.q === undefined || search.q === '' ? undefined : String(search.q),
  super: search.super === true || search.super === 'true' || search.super === 1 ? true : undefined,
  sort: sortOf(search.sort),
});

export const studentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: studentsSearch,
});

export type StudentView = 'domain' | 'elq' | 'amcat' | 'exams' | 'attendance';
const VIEWS: StudentView[] = ['domain', 'elq', 'amcat', 'exams', 'attendance'];

export interface StudentSearch {
  view?: StudentView;
}

export const studentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/s/$slug',
  validateSearch: (search: Record<string, unknown>): StudentSearch => ({
    view: VIEWS.includes(search.view as StudentView) ? (search.view as StudentView) : undefined,
  }),
});

export const campusesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/campuses',
});

export interface CampusSearch {
  batch?: string;
  tab?: string;
  /** The open test: its section copies' ids ("123,456"). */
  test?: string;
  /** Test lists: release year and term (1 = Jan–Jun, 2 = Jul–Dec), and a name search. */
  year?: number;
  term?: 1 | 2;
  q?: string;
}

export const campusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/campuses/$id',
  validateSearch: (search: Record<string, unknown>): CampusSearch => ({
    batch: batchOf(search.batch),
    tab: text(search.tab),
    test:
      typeof search.test === 'string' && /^\d+(,\d+)*$/.test(search.test)
        ? search.test
        : typeof search.test === 'number'
          ? String(search.test)
          : undefined,
    year: positive(search.year),
    term:
      search.term === 1 || search.term === '1'
        ? 1
        : search.term === 2 || search.term === '2'
          ? 2
          : undefined,
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
  }),
});

export interface SuperSearch {
  campus?: string;
  program?: string;
  batch?: string;
  q?: string;
  sort?: SortKey;
}

export const superRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/super-100',
  validateSearch: (search: Record<string, unknown>): SuperSearch => ({
    campus: text(search.campus),
    program: text(search.program),
    batch: batchOf(search.batch),
    q: search.q === undefined || search.q === '' ? undefined : String(search.q),
    sort: sortOf(search.sort),
  }),
});

export const issuesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/issues',
  validateSearch: validateIssuesSearch,
});

export const placementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/placements',
  validateSearch: validatePlacementsSearch,
});

export const teamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/team',
});

export const routeTree = rootRoute.addChildren([
  loginRoute,
  studentsRoute,
  studentRoute,
  campusesRoute,
  campusRoute,
  superRoute,
  issuesRoute,
  placementsRoute,
  teamRoute,
]);
