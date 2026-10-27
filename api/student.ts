// GET /api/student?s={username}: one student, for the profile and coding-card pages.
// The full list (/api/students) needs a login; a student's own share link does not, so it
// gets exactly one row and nothing about anyone else. Old profile addresses (from before
// usernames) still resolve; the response carries the current one in `slug`.
//
// Signed-in staff also see LMS standing (debarred, inactive) and students who have not
// linked any coding profile yet; the public sees neither.

import type { Student } from '../src/lib/students/types';
import { sessionUser } from './_auth';
import { findStudent, hasDatabase } from './_roster';
import { sheetStudents } from './students';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const slug = new URL(request.url).searchParams.get('s') ?? '';
  const staff = Boolean(await sessionUser(request));

  let student: Student | null | undefined;
  if (hasDatabase()) {
    try {
      student = slug ? await findStudent(slug, staff) : null;
    } catch (error) {
      console.error('[student]', error);
      return new Response(JSON.stringify({ error: 'Could not load the profile.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
  } else {
    const students = await sheetStudents();
    if (students instanceof Response) return students;
    student = students.find((candidate) => candidate.slug === slug);
  }

  return new Response(JSON.stringify(student ? { student } : { error: 'Student not found' }), {
    status: student ? 200 : 404,
    headers: {
      'Content-Type': 'application/json',
      // Staff and public answers differ for the same URL, so with the database (a fast
      // lookup) nothing is cached at the CDN. The sheet fallback is slow to read, so its
      // answers, which are the same for everyone, are cached for a minute.
      'Cache-Control': hasDatabase()
        ? 'no-store'
        : 'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
