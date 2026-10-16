import { createFileRoute } from '@tanstack/react-router';

import CodingCardPage from '@/pages/CodingCardPage';

// /s/{slug}/card: the student's shareable coding card. The trailing underscore in the file
// name keeps it a sibling of /s/{slug} rather than a child rendered inside it.
export const Route = createFileRoute('/s/$slug_/card')({
  component: CodingCardPage,
});
