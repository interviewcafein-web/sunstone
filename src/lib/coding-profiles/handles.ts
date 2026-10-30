// Reads a coding username typed by a student: the username itself or a link to the profile.
// Shared by the student form (src/pages/StudentFormPage.tsx), which warns as they type, and
// its API (api/student-form.ts), which accepts nothing the form would not.

import type { PlatformId } from './types';

/** The username in a profile link on each platform. */
export const PROFILE_URL_PATTERNS: Record<PlatformId, RegExp> = {
  leetcode: /leetcode\.com\/(?:u\/)?([^/?#\s]+)/i,
  geeksforgeeks: /geeksforgeeks\.org\/(?:profile|user)\/([^/?#\s]+)/i,
  hackerrank: /hackerrank\.com\/(?:profile\/)?([^/?#\s]+)/i,
  codeforces: /codeforces\.com\/profile\/([^/?#\s]+)/i,
  codechef: /codechef\.com\/users\/([^/?#\s]+)/i,
  github: /github\.com\/([^/?#\s]+)/i,
};

/** Each platform's site, to spot a link to the wrong one. */
const SITES: Record<PlatformId, string> = {
  leetcode: 'leetcode.com',
  geeksforgeeks: 'geeksforgeeks.org',
  hackerrank: 'hackerrank.com',
  codeforces: 'codeforces.com',
  codechef: 'codechef.com',
  github: 'github.com',
};

/** Pages on the platforms that a pasted link may point at instead of a profile. */
const NOT_PROFILES = new Set([
  'problems',
  'problemset',
  'contest',
  'contests',
  'discuss',
  'explore',
  'studyplan',
  'problem-list',
  'challenges',
  'dashboard',
  'domains',
  'settings',
  'login',
  'signup',
  'accounts',
  'practice',
  'learn',
  'orgs',
  'organizations',
  'topics',
  'about',
  'u',
  'user',
  'users',
  'profile',
]);

/** Letters, digits, and _ . - inside (most platforms). */
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/;
/** GitHub: letters, digits and single hyphens inside, up to 39. */
const GITHUB = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export type HandleCheck = { ok: true; username: string | null } | { ok: false; error: string };

/**
 * The username in what was typed: `null` when left empty, or why it cannot be one.
 * `name` is the platform's display name, for the messages.
 */
export function readHandle(platform: PlatformId, raw: string, name: string): HandleCheck {
  const value = raw.trim();
  if (!value) return { ok: true, username: null };

  const isLink = /^(https?:\/\/|www\.)|\.(com|org|in)\//i.test(value);
  let username = value.replace(/^@/, '');
  if (isLink) {
    const found = value.match(PROFILE_URL_PATTERNS[platform])?.[1];
    if (!found) {
      return value.toLowerCase().includes(SITES[platform])
        ? {
            ok: false,
            error: `This is not a ${name} profile link. Open your profile and copy its link.`,
          }
        : { ok: false, error: `This is not a ${name} link. Type your ${name} username instead.` };
    }
    username = decodeURIComponent(found);
    if (NOT_PROFILES.has(username.toLowerCase())) {
      return {
        ok: false,
        error: `This link is not your ${name} profile. Open your profile and copy its link.`,
      };
    }
  }

  if (/\s/.test(username)) return { ok: false, error: 'A username has no spaces.' };
  if (username.includes('@')) {
    return { ok: false, error: `That looks like an email. Type your ${name} username instead.` };
  }
  const valid = platform === 'github' ? GITHUB.test(username) : USERNAME.test(username);
  if (!valid) {
    return {
      ok: false,
      error:
        username.length > 40
          ? 'That is too long for a username.'
          : `That is not a valid ${name} username. Use only letters, digits${platform === 'github' ? ' and hyphens' : ', _ . and -'}.`,
    };
  }
  return { ok: true, username };
}
