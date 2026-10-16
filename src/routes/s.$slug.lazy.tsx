import { createLazyFileRoute } from '@tanstack/react-router';

import StudentProfilePage from '@/pages/StudentProfilePage';

export const Route = createLazyFileRoute('/s/$slug')({
  component: StudentProfilePage,
});
