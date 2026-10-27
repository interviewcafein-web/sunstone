import { createFileRoute } from '@tanstack/react-router';

import PrivacyPage from '@/pages/PrivacyPage';

// Public: linked from the footer and from Google's sign-in consent screen.
export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
});
