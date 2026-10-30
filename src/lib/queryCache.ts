// What this browser keeps between visits, so pages open at once with the numbers from last
// time and refresh in the background: the student list, coding numbers, campus pages, the
// campus list, the 360° numbers and student pages. Kept in IndexedDB (too much for
// localStorage) for a day, and forgotten on sign-out and on the sign-in page, so the next
// person to sign in on this browser never sees it.

import type { Query, QueryClient } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';

import { SUMMARY_QUERY_KEY } from '@/hooks/useStudentSummaries';

const KEY = 'vertex:query-cache';
/** Where earlier versions kept only the coding numbers (localStorage). */
const OLD_KEY = 'sunstone:query-cache';

/** The data worth keeping: what the main pages are built from (not the session or the bell). */
const KEPT = new Set([SUMMARY_QUERY_KEY, 'students', 'student', 'assessments']);

export const keepQuery = (query: Query) =>
  query.state.status === 'success' && KEPT.has(String(query.queryKey[0]));

// IndexedDB can be missing or blocked (private windows): then nothing is kept.
const storage = {
  getItem: (key: string) => get<PersistedClient>(key).catch(() => undefined),
  setItem: (key: string, value: PersistedClient) => set(key, value).catch(() => undefined),
  removeItem: (key: string) => del(key).catch(() => undefined),
};

// Saves at most every two seconds while the page keeps updating. IndexedDB stores the objects
// as they are, so there is no large JSON text to build on each save.
let latest: PersistedClient | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Set by forgetCache: a copy still being read when it was forgotten is not brought back. */
let forgotten = false;

export const persister: Persister = {
  persistClient: (client) => {
    latest = client;
    timer ??= setTimeout(() => {
      timer = undefined;
      if (latest) void storage.setItem(KEY, latest);
    }, 2000);
  },
  restoreClient: async () => {
    const saved = await storage.getItem(KEY);
    return forgotten ? undefined : saved;
  },
  removeClient: () => storage.removeItem(KEY),
};

/** Forgets everything kept here about students and campuses, in memory and in the browser. */
export async function forgetCache(client?: QueryClient) {
  forgotten = true;
  client?.removeQueries({ predicate: (query) => KEPT.has(String(query.queryKey[0])) });
  latest = undefined;
  await storage.removeItem(KEY);
  try {
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Storage blocked: nothing was kept there.
  }
}

/** The previous version kept a copy in localStorage; IndexedDB has it now. */
export function dropOldCopy() {
  try {
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Storage blocked.
  }
}
