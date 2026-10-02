// Reads the student list from the Google Sheet (a Google Form response sheet) and returns
// only what the dashboard needs. Deployed by Vercel as an Edge Function at /api/students;
// `vite dev` mounts the same handler (see vite.config.ts).
//
// The sheet also holds mobile numbers and email addresses. Reading it here, server-side,
// keeps the sheet id and those columns out of the browser: nothing but the fields in
// `Student` is ever sent.

import type { Handles, PlatformId } from '../src/lib/coding-profiles/types';
import type { Student, StudentsResponse } from '../src/lib/students/types';

export const config = { runtime: 'edge' };

type Field = 'name' | 'email' | 'campus' | 'course' | 'batch' | PlatformId;

// Matched against the sheet's header row, so columns can be reordered or renamed slightly.
const HEADER_PATTERNS: [Field, RegExp][] = [
  ['name', /^name\b/i],
  ['email', /e-?mail/i],
  ['campus', /campus/i],
  ['course', /course/i],
  ['batch', /year|batch|passing/i],
  ['leetcode', /leetcode/i],
  ['geeksforgeeks', /geeks|gfg/i],
  ['hackerrank', /hackerrank/i],
  ['codeforces', /codeforces/i],
  ['codechef', /codechef/i],
  ['github', /github/i],
];

// Students paste profile links as often as usernames; pull the username out of either.
const PROFILE_URL_PATTERNS: Record<PlatformId, RegExp> = {
  leetcode: /leetcode\.com\/(?:u\/)?([^/?#\s]+)/i,
  geeksforgeeks: /geeksforgeeks\.org\/(?:profile|user)\/([^/?#\s]+)/i,
  hackerrank: /hackerrank\.com\/(?:profile\/)?([^/?#\s]+)/i,
  codeforces: /codeforces\.com\/profile\/([^/?#\s]+)/i,
  codechef: /codechef\.com\/users\/([^/?#\s]+)/i,
  github: /github\.com\/([^/?#\s]+)/i,
};

const PLATFORM_IDS = Object.keys(PROFILE_URL_PATTERNS) as PlatformId[];
const BLANK = /^(no|na|n\/a|nil|none|null|no id|not available|[-.\s]*)$/i;
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const ANY_URL = /https?:\/\/\S+/gi;

/** Returns the username, `null` for "no account", or `'invalid'` for an unusable entry. */
function parseHandle(platform: PlatformId, raw: string): string | null | 'invalid' {
  const value = raw.trim();
  if (BLANK.test(value)) return null;

  const fromUrl = value.match(PROFILE_URL_PATTERNS[platform])?.[1];
  if (fromUrl) return USERNAME.test(fromUrl) ? fromUrl : 'invalid';

  // "handle - LeetCode Profile https://share.google/…": keep what precedes the label.
  const text = value
    .replace(ANY_URL, '')
    .split(/\s[-|]\s/)[0]
    .trim()
    .replace(/^@/, '');
  return USERNAME.test(text) ? text : 'invalid';
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function stableId(seed: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  return [...new Uint8Array(digest).slice(0, 8)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

const clean = (value: string | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

function reply(status: number, body: unknown, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache },
  });
}

export default async function handler(): Promise<Response> {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) return reply(500, { error: 'SHEET_ID is not configured.' });

  const gid = process.env.SHEET_GID;
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv${
    gid ? `&gid=${encodeURIComponent(gid)}` : ''
  }`;

  let csv: string;
  try {
    const response = await fetch(url);
    // A sheet that is not link-shared answers with a sign-in page instead of CSV.
    if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) {
      return reply(502, { error: 'The sheet is not readable. Is it shared by link?' });
    }
    csv = await response.text();
  } catch {
    return reply(502, { error: 'Could not reach Google Sheets.' });
  }

  const [header = [], ...rows] = parseCsv(csv);
  const columns = new Map<Field, number>();
  header.forEach((title, index) => {
    const field = HEADER_PATTERNS.find(([, pattern]) => pattern.test(title.trim()))?.[0];
    if (field && !columns.has(field)) columns.set(field, index);
  });
  if (!columns.has('name')) return reply(502, { error: 'The sheet has no "Name" column.' });

  const cell = (row: string[], field: Field) => clean(row[columns.get(field) ?? -1]);

  // A student who submits the form again replaces their earlier row.
  const byPerson = new Map<string, Student>();
  for (const row of rows) {
    const name = cell(row, 'name');
    if (!name) continue;

    const handles: Handles = {};
    const invalid: PlatformId[] = [];
    for (const platform of PLATFORM_IDS) {
      const parsed = parseHandle(platform, cell(row, platform));
      if (parsed === 'invalid') invalid.push(platform);
      else if (parsed) handles[platform] = parsed;
    }

    const identity = cell(row, 'email').toLowerCase() || name.toLowerCase();
    byPerson.set(identity, {
      id: await stableId(`${sheetId}:${identity}`),
      name,
      campus: cell(row, 'campus') || 'Unknown campus',
      course: cell(row, 'course'),
      batch: cell(row, 'batch'),
      handles,
      invalid,
    });
  }

  const body: StudentsResponse = {
    students: [...byPerson.values()],
    fetchedAt: new Date().toISOString(),
  };
  // Shared-cache for a few seconds so many open dashboards do not each hit Google.
  return reply(200, body, 'public, max-age=0, s-maxage=20, stale-while-revalidate=40');
}
