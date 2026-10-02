import type { Platform, PlatformId } from './types';

const at =
  (base: string, suffix = '') =>
  (handle: string) =>
    `${base}${encodeURIComponent(handle)}${suffix}`;

export const PLATFORMS: Platform[] = [
  {
    id: 'leetcode',
    name: 'LeetCode',
    placeholder: 'lee215',
    direct: false,
    profileUrl: at('https://leetcode.com/u/', '/'),
  },
  {
    id: 'geeksforgeeks',
    name: 'GeeksforGeeks',
    placeholder: 'striver',
    direct: false,
    profileUrl: at('https://www.geeksforgeeks.org/profile/'),
  },
  {
    id: 'hackerrank',
    name: 'HackerRank',
    placeholder: 'gennady',
    direct: false,
    profileUrl: at('https://www.hackerrank.com/profile/'),
  },
  {
    id: 'codeforces',
    name: 'Codeforces',
    placeholder: 'tourist',
    direct: true,
    profileUrl: at('https://codeforces.com/profile/'),
  },
  {
    id: 'codechef',
    name: 'CodeChef',
    placeholder: 'gennady.korotkevich',
    direct: false,
    profileUrl: at('https://www.codechef.com/users/'),
  },
  {
    id: 'github',
    name: 'GitHub',
    placeholder: 'torvalds',
    direct: true,
    profileUrl: at('https://github.com/'),
  },
];

export const PLATFORM_IDS = PLATFORMS.map((platform) => platform.id) as PlatformId[];

/** Platforms whose headline number is "problems solved" (everything except GitHub). */
export const SOLVING_PLATFORM_IDS = PLATFORM_IDS.filter((id) => id !== 'github');
