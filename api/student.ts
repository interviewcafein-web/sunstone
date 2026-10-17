// GET /api/student?s={slug}: one student, for the public profile and coding-card pages.
// The full list (/api/students) needs a login; a student's own share link does not, so it
// gets exactly one row and nothing about anyone else.

import students from './students';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const slug = new URL(request.url).searchParams.get('s') ?? '';
  const response = await students();
  if (!response.ok) return response;

  const body = (await response.json()) as { students: { slug: string }[] };
  const student = body.students.find((candidate) => candidate.slug === slug);
  return new Response(JSON.stringify(student ? { student } : { error: 'Student not found' }), {
    status: student ? 200 : 404,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
