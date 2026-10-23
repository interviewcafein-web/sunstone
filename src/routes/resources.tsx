import { createFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import ResourcesPage from '@/pages/ResourcesPage';

export interface ResourcesSearch {
  q?: string;
  tag?: string;
  /** Id of the resource whose preview is open. */
  view?: string;
}

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined);

export const Route = createFileRoute('/resources')({
  validateSearch: (search: Record<string, unknown>): ResourcesSearch => ({
    q: text(search.q),
    tag: text(search.tag),
    view: text(search.view),
  }),
  component: () => (
    <RequireLogin>
      <ResourcesPage />
    </RequireLogin>
  ),
});
