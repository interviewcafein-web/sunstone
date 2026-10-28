import { createFileRoute } from '@tanstack/react-router';

export interface AssessmentsSearch {
  /** LMS campus id. */
  campus?: number;
  /** Admission year. */
  batch?: number;
  /** The open test: its id, or its section copies' ids ("123,456"). */
  test?: string;
  /** Test type filter. */
  type?: string;
  /** Campus tab: overview, subject, modules, students. */
  tab?: string;
}

const positive = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

export const Route = createFileRoute('/campuses')({
  validateSearch: (search: Record<string, unknown>): AssessmentsSearch => ({
    campus: positive(search.campus),
    batch: positive(search.batch),
    test:
      typeof search.test === 'string' && /^\d+(,\d+)*$/.test(search.test)
        ? search.test
        : typeof search.test === 'number'
          ? String(search.test)
          : undefined,
    type: typeof search.type === 'string' ? search.type : undefined,
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
});
