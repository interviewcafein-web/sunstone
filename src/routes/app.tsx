import { createFileRoute } from '@tanstack/react-router';

import AppDownloadPage from '@/pages/AppDownloadPage';

// Public: the link shared with staff to install the Vertex Android app.
export const Route = createFileRoute('/app')({
  component: AppDownloadPage,
});
