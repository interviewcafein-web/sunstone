import { createFileRoute } from '@tanstack/react-router';

import StudentsPage from '@/pages/StudentsPage';
import { PLATFORM_IDS } from '@/lib/coding-profiles/platforms';
import type { PlatformId } from '@/lib/coding-profiles/types';

export type SortKey = 'total' | 'name' | PlatformId;

export interface StudentsSearch {
  campus?: string;
  course?: string;
  batch?: string;
  q?: string;
  sort?: SortKey;
}

const SORT_KEYS: string[] = ['total', 'name', ...PLATFORM_IDS];

const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim() || undefined
    : undefined;

// Filters live in the URL so a campus or batch view can be bookmarked and shared.
export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): StudentsSearch => {
    const sort = text(search.sort);
    return {
      campus: text(search.campus),
      course: text(search.course),
      batch: text(search.batch),
      // Not trimmed: this is bound to the search box, and trimming would eat typed spaces.
      q: search.q === undefined || search.q === '' ? undefined : String(search.q),
      sort: sort && SORT_KEYS.includes(sort) && sort !== 'total' ? (sort as SortKey) : undefined,
    };
  },
  component: StudentsPage,
});
