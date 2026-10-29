import { createFileRoute } from '@tanstack/react-router';

export interface AssessmentsSearch {
  /** LMS campus id. */
  campus?: number;
  /** Admission year ("2025"), program ("BCA:") or cohort ("BCA:2025"). */
  batch?: string;
  /** The open test: its id, or its section copies' ids ("123,456"). */
  test?: string;
  /** Test type filter. */
  type?: string;
  /** Campus tab: overview, subject, modules, students. */
  tab?: string;
  /** Test lists: the year and term (1 = Jan–Jun, 2 = Jul–Dec) they were released in, and a
   *  name search. */
  year?: number;
  term?: 1 | 2;
  q?: string;
}

const positive = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

export const Route = createFileRoute('/campuses')({
  validateSearch: (search: Record<string, unknown>): AssessmentsSearch => ({
    campus: positive(search.campus),
    batch:
      typeof search.batch === 'number' || typeof search.batch === 'string'
        ? /^(\d{4}|[A-Za-z. ]{2,20}:(\d{4})?)$/.test(String(search.batch))
          ? String(search.batch)
          : undefined
        : undefined,
    test:
      typeof search.test === 'string' && /^\d+(,\d+)*$/.test(search.test)
        ? search.test
        : typeof search.test === 'number'
          ? String(search.test)
          : undefined,
    type: typeof search.type === 'string' ? search.type : undefined,
    tab: typeof search.tab === 'string' ? search.tab : undefined,
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
