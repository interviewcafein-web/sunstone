import { createFileRoute } from '@tanstack/react-router';

// Short profile link for a student in the sheet: /s/{slug}. On Vercel, api/share.ts serves
// this path so link previews show the student's own card. The page itself is in
// s.$slug.lazy.tsx, so the students dashboard does not download the chart library.
export const Route = createFileRoute('/s/$slug')({});
