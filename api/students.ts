// GET /api/students: the whole list, for signed-in staff only. Deployed by Vercel as an Edge
// Function; `vite dev` mounts the same handler (see vite.config.ts).
//
// The list comes from the database (LMS students + their form usernames). Until
// DATABASE_URL is configured it falls back to reading the Google Form sheet directly.
// Either way nothing but the fields in `Student` is sent: no emails or mobile numbers.
// Never cached by the CDN, so a signed-in response can never be served to someone else.

import type { Student, StudentsResponse } from '../src/lib/students/types';
import { sessionViewer } from './_auth';
import { hasDatabase, listStudents } from './_roster';
import { readSheet } from './_sheet';

export const config = { runtime: 'edge' };

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Strips the sheet's contact details down to the public `Student` fields. */
export async function sheetStudents(): Promise<Student[] | Response> {
  const sheet = await readSheet();
  if ('error' in sheet) return reply(sheet.status, { error: sheet.error });
  return sheet.students.map(({ id, slug, name, campus, course, batch, handles, invalid }) => ({
    id,
    slug,
    name,
    campus,
    course,
    batch,
    handles,
    invalid,
  }));
}

export default async function handler(request: Request): Promise<Response> {
  const viewer = await sessionViewer(request);
  if (!viewer) return reply(401, { error: 'Login required' });

  let students: Student[];
  if (hasDatabase()) {
    try {
      students = await listStudents(viewer);
    } catch (error) {
      console.error('[students]', error);
      return reply(503, { error: 'The student list could not be loaded. Try again shortly.' });
    }
  } else if (viewer.campusIds !== null) {
    // The sheet has no LMS campus ids, so campus staff need the database.
    students = [];
  } else {
    const result = await sheetStudents();
    if (result instanceof Response) return result;
    students = result;
  }

  const body: StudentsResponse = { students, fetchedAt: new Date().toISOString() };
  return reply(200, body);
}
