import { createLazyFileRoute } from '@tanstack/react-router';

import StudentFormPage from '@/pages/StudentFormPage';

// Public and unlisted: the link is sent to students, and nothing on the site links here.
export const Route = createLazyFileRoute('/coding-usernames')({
  component: StudentFormPage,
});
