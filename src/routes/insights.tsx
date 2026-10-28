import { createFileRoute } from '@tanstack/react-router';

export interface InsightsSearch {
  /** Campus name, as on the students page. */
  campus?: string;
  /** Admission year. */
  batch?: string;
}

const text = (value: unknown) =>
  typeof value === 'string' && value
    ? value
    : typeof value === 'number'
      ? String(value)
      : undefined;

// The page itself is in insights.lazy.tsx, downloaded only when someone opens it.
export const Route = createFileRoute('/insights')({
  validateSearch: (search: Record<string, unknown>): InsightsSearch => ({
    campus: text(search.campus),
    batch: text(search.batch),
  }),
});
