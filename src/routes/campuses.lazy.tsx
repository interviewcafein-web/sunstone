import { createLazyFileRoute } from '@tanstack/react-router';

import { RequireLogin } from '@/components/common/RequireLogin';
import AssessmentsPage from '@/pages/AssessmentsPage';

// The campuses page (and its charts) downloads only when someone opens it.
export const Route = createLazyFileRoute('/campuses')({
  component: () => (
    <RequireLogin>
      <AssessmentsPage />
    </RequireLogin>
  ),
});
