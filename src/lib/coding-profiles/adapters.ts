// One adapter per platform: fetch a public profile by username and normalize it.
// Codeforces and GitHub are called straight from the browser. The rest send no CORS
// headers, so they go through the same-origin relay (api/relay.ts).

import {
  ProfileError,
  type CodingProfile,
  type CountItem,
  type PlatformId,
  type Stat,
} from './types';

type AdapterResult = Omit<CodingProfile, 'platform' | 'username'>;

const RELAY_PATH = '/api/relay';

interface RequestOptions {
  direct?: boolean;
  init?: RequestInit;
  as?: 'json' | 'text';
  notFound?: number[];
}

export async function request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const { direct = false, init, as = 'json', notFound = [404] } = options;
  const target = direct ? url : `${RELAY_PATH}?url=${encodeURIComponent(url)}`;

  let response: Response;
  try {
    response = await fetch(target, init);
  } catch {
    throw new ProfileError('network', 'Network error while fetching.');
  }

  // Without the function deployed, a static host answers /api/relay with the SPA page.
  if (!direct && !response.headers.has('x-relay')) {
    throw new ProfileError('relay', 'The relay function is not reachable on this host.');
  }
  if (notFound.includes(response.status)) throw new ProfileError('not_found', 'User not found.');
  if (response.status === 429) {
    throw new ProfileError('rate_limited', 'The platform is rate limiting requests.');
  }
  if (response.status === 403) {
    throw new ProfileError('upstream', 'The platform refused the request (HTTP 403).');
  }
  if (!response.ok) {
    throw new ProfileError('upstream', `Platform returned HTTP ${response.status}.`);
  }

  try {
    return (as === 'text' ? await response.text() : await response.json()) as T;
  } catch {
    throw new ProfileError('upstream', 'Platform returned an unreadable response.');
  }
}

export const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const dayFromSeconds = (seconds: number | string) =>
  new Date(Number(seconds) * 1000).toISOString().slice(0, 10);

const padDay = (value: string) =>
  value
    .split('-')
    .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
    .join('-');

function addDay(calendar: Record<string, number>, day: string, count = 1) {
  calendar[day] = (calendar[day] || 0) + count;
}

function topN(counts: Record<string, number>, limit = 12): CountItem[] {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Drops stats the platform did not return. */
function stats(entries: [string, unknown][]): Stat[] {
  return entries
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => ({ label, value: value as string | number }));
}

// ---------------------------------------------------------------- LeetCode

const LEETCODE_QUERY = `
query profile($u: String!) {
  matchedUser(username: $u) {
    username
    profile { ranking userAvatar realName }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    badges { displayName icon }
    tagProblemCounts {
      advanced { tagName problemsSolved }
      intermediate { tagName problemsSolved }
      fundamental { tagName problemsSolved }
    }
    userCalendar { streak totalActiveDays submissionCalendar }
  }
  userContestRanking(username: $u) { rating attendedContestsCount globalRanking }
}`;

async function leetcode(username: string): Promise<AdapterResult> {
  const payload = await request('https://leetcode.com/graphql', {
    init: postJson({ query: LEETCODE_QUERY, variables: { u: username } }),
  });
  const user = payload?.data?.matchedUser;
  if (!user) throw new ProfileError('not_found', 'User not found.');

  const solvedBy: Record<string, number> = Object.fromEntries(
    user.submitStatsGlobal.acSubmissionNum.map((row: any) => [row.difficulty, row.count])
  );
  const tags: Record<string, number> = {};
  for (const level of Object.values<any[]>(user.tagProblemCounts || {})) {
    for (const tag of level || []) tags[tag.tagName] = tag.problemsSolved;
  }
  const calendar: Record<string, number> = {};
  const rawCalendar = JSON.parse(user.userCalendar?.submissionCalendar || '{}');
  for (const [seconds, count] of Object.entries<number>(rawCalendar)) {
    addDay(calendar, dayFromSeconds(seconds), count);
  }
  const contest = payload.data.userContestRanking;

  return {
    name: user.profile?.realName || user.username,
    avatar: user.profile?.userAvatar,
    profileUrl: `https://leetcode.com/u/${encodeURIComponent(user.username)}/`,
    headline: stats([
      ['Global rank', user.profile?.ranking],
      ['Contest rating', contest ? Math.round(contest.rating) : null],
      ['Contests', contest?.attendedContestsCount],
      ['Streak', user.userCalendar?.streak],
    ]),
    solved: {
      total: solvedBy.All ?? 0,
      breakdown: ['Easy', 'Medium', 'Hard'].map((label) => ({
        label,
        count: solvedBy[label] ?? 0,
      })),
    },
    badges: (user.badges || []).map((badge: any) => ({
      name: badge.displayName,
      icon: badge.icon?.startsWith('/') ? `https://leetcode.com${badge.icon}` : badge.icon,
    })),
    topics: topN(tags),
    calendar,
    notes: [],
  };
}

// -------------------------------------------------------------- Codeforces

async function codeforcesCall(method: string, query: string) {
  const payload = await request(`https://codeforces.com/api/${method}?${query}`, {
    direct: true,
    notFound: [400, 404],
  });
  if (payload.status !== 'OK') throw new ProfileError('upstream', payload.comment || 'API error.');
  return payload.result;
}

async function codeforces(username: string): Promise<AdapterResult> {
  const handle = encodeURIComponent(username);
  // Sequential on purpose: the API throttles bursts from one IP.
  const [info] = await codeforcesCall('user.info', `handles=${handle}`);
  const submissions: any[] = await codeforcesCall('user.status', `handle=${handle}`);
  const contests: any[] = await codeforcesCall('user.rating', `handle=${handle}`);

  const solved = new Map<string, any>();
  const calendar: Record<string, number> = {};
  for (const submission of submissions) {
    addDay(calendar, dayFromSeconds(submission.creationTimeSeconds));
    if (submission.verdict !== 'OK') continue;
    const problem = submission.problem;
    solved.set(`${problem.contestId ?? problem.problemsetName}-${problem.index}`, problem);
  }

  const tags: Record<string, number> = {};
  const buckets: Record<string, number> = {
    'Under 1200': 0,
    '1200–1599': 0,
    '1600–1999': 0,
    '2000+': 0,
    Unrated: 0,
  };
  for (const problem of solved.values()) {
    for (const tag of problem.tags || []) tags[tag] = (tags[tag] || 0) + 1;
    const rating = problem.rating;
    if (!rating) buckets.Unrated += 1;
    else if (rating < 1200) buckets['Under 1200'] += 1;
    else if (rating < 1600) buckets['1200–1599'] += 1;
    else if (rating < 2000) buckets['1600–1999'] += 1;
    else buckets['2000+'] += 1;
  }

  return {
    name: [info.firstName, info.lastName].filter(Boolean).join(' ') || info.handle,
    avatar: info.titlePhoto,
    profileUrl: `https://codeforces.com/profile/${encodeURIComponent(info.handle)}`,
    headline: stats([
      ['Rating', info.rating],
      ['Max rating', info.maxRating],
      ['Rank', info.rank],
      ['Contests', contests.length],
    ]),
    solved: {
      total: solved.size,
      breakdown: Object.entries(buckets).map(([label, count]) => ({ label, count })),
    },
    badges: [],
    topics: topN(tags),
    calendar,
    notes: ['Codeforces has no badges.'],
  };
}

// ------------------------------------------------------------------ GitHub

async function github(username: string): Promise<AdapterResult> {
  const login = encodeURIComponent(username);
  const user = await request(`https://api.github.com/users/${login}`, { direct: true });
  const repos: any[] = await request(
    `https://api.github.com/users/${login}/repos?per_page=100&sort=pushed`,
    { direct: true }
  );

  let stars = 0;
  const languages: Record<string, number> = {};
  for (const repo of repos) {
    if (repo.fork) continue;
    stars += repo.stargazers_count;
    if (repo.language) languages[repo.language] = (languages[repo.language] || 0) + 1;
  }

  // The contribution calendar is not in GitHub's REST API (GraphQL needs a token),
  // so this uses a community endpoint. Treat it as optional.
  const calendar: Record<string, number> = {};
  let contributions: number | null = null;
  const notes = ['GitHub achievements are not exposed by any API.'];
  try {
    const data = await request(`https://github-contributions-api.jogruber.de/v4/${login}?y=last`, {
      direct: true,
    });
    for (const entry of data.contributions) if (entry.count) calendar[entry.date] = entry.count;
    contributions = data.total?.lastYear ?? null;
  } catch {
    notes.push('Contribution calendar unavailable (third-party endpoint).');
  }
  if (user.public_repos > repos.length) {
    notes.push('Stars and languages cover the 100 most recent repos.');
  }

  return {
    name: user.name || user.login,
    avatar: user.avatar_url,
    profileUrl: user.html_url,
    headline: stats([
      ['Public repos', user.public_repos],
      ['Stars', stars],
      ['Followers', user.followers],
      ['Contributions (1y)', contributions],
    ]),
    solved: null,
    badges: [],
    topics: topN(languages),
    topicsLabel: 'Repos by language',
    calendar,
    notes,
  };
}

// ----------------------------------------------------------- GeeksforGeeks

const GFG_SUBMISSIONS = 'https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/';

async function geeksforgeeks(username: string): Promise<AdapterResult> {
  const profile = await request(
    `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${encodeURIComponent(username)}`,
    { notFound: [400, 404] }
  );
  const info = profile.data;

  const year = new Date().getUTCFullYear();
  const [solvedLists, ...years] = await Promise.all([
    request(GFG_SUBMISSIONS, {
      init: postJson({ handle: username, requestType: '', year: '', month: '' }),
    }),
    ...[year, year - 1].map((y) =>
      request(GFG_SUBMISSIONS, {
        init: postJson({
          handle: username,
          requestType: 'getYearwiseUserSubmissions',
          year: y,
          month: '',
        }),
      }).catch(() => null)
    ),
  ]);

  const calendar: Record<string, number> = {};
  for (const yearData of years) {
    for (const [day, count] of Object.entries(yearData?.result || {})) {
      addDay(calendar, day, Number(count));
    }
  }
  const lists = solvedLists.result || {};

  return {
    name: info.name || username,
    avatar: info.profile_image_url,
    profileUrl: `https://www.geeksforgeeks.org/profile/${encodeURIComponent(username)}`,
    headline: stats([
      ['Coding score', info.score],
      ['Institute rank', info.institute_rank],
      ['Longest POTD streak', info.pod_solved_longest_streak],
    ]),
    solved: {
      total: info.total_problems_solved ?? 0,
      breakdown: ['School', 'Basic', 'Easy', 'Medium', 'Hard'].map((label) => ({
        label,
        count: Object.keys(lists[label] || {}).length,
      })),
    },
    badges: [],
    topics: [],
    calendar,
    notes: [
      ...(info.institute_name ? [info.institute_name] : []),
      'GeeksforGeeks exposes no topic-wise counts or badges publicly.',
    ],
  };
}

// -------------------------------------------------------------- HackerRank

async function hackerrank(username: string): Promise<AdapterResult> {
  const handle = encodeURIComponent(username);
  const base = 'https://www.hackerrank.com/rest';
  const profile = await request(`${base}/contests/master/hackers/${handle}/profile`);
  const [badgeData, history] = await Promise.all([
    request(`${base}/hackers/${handle}/badges`).catch(() => ({ models: [] })),
    request<Record<string, number>>(`${base}/hackers/${handle}/submission_histories`).catch(
      () => ({})
    ),
  ]);

  const model = profile.model;
  const badges: any[] = badgeData.models || [];
  const calendar: Record<string, number> = {};
  for (const [day, count] of Object.entries(history)) addDay(calendar, day, Number(count));

  return {
    name: model.name || model.username,
    avatar: model.avatar,
    profileUrl: `https://www.hackerrank.com/profile/${encodeURIComponent(model.username)}`,
    headline: stats([
      ['Badges', badges.length],
      ['Total stars', badges.reduce((sum, badge) => sum + (badge.stars || 0), 0)],
      ['Country', model.country],
    ]),
    solved: {
      total: badges.reduce((sum, badge) => sum + (badge.solved || 0), 0),
      breakdown: [],
    },
    badges: badges.map((badge) => ({ name: `${badge.badge_name} · ${badge.stars}★` })),
    topics: topN(Object.fromEntries(badges.map((badge) => [badge.badge_name, badge.solved || 0]))),
    topicsLabel: 'Solved by domain',
    calendar,
    notes: ['Solved count is the sum across badge domains; HackerRank has no single total.'],
  };
}

// ---------------------------------------------------------------- CodeChef

// CodeChef has no public API: this scrapes the profile page, so it is the most
// fragile adapter and will break when the markup changes.
async function codechef(username: string): Promise<AdapterResult> {
  const handle = encodeURIComponent(username);
  const html = await request<string>(`https://www.codechef.com/users/${handle}`, { as: 'text' });
  if (!html.includes('rating-number')) throw new ProfileError('not_found', 'User not found.');

  const number = (pattern: RegExp) => {
    const match = html.match(pattern);
    return match ? Number(match[1]) : null;
  };
  const jsonVar = (name: string): any[] => {
    const match = html.match(new RegExp(`var ${name} = (\\[.*?\\]);`, 's'));
    if (!match) return [];
    try {
      return JSON.parse(match[1]);
    } catch {
      return [];
    }
  };

  const starBlock = html.match(/class="rating-star">([\s\S]*?)<\/div>/);
  const stars = starBlock ? (starBlock[1].match(/&#9733;|★/g) || []).length : 0;
  const globalRank = html.match(/<strong>\s*([^<]*?)\s*<\/strong>\s*<\/a>\s*Global Rank/);

  const calendar: Record<string, number> = {};
  for (const entry of jsonVar('userDailySubmissionsStats')) {
    if (entry?.date) addDay(calendar, padDay(String(entry.date)), Number(entry.value) || 0);
  }

  return {
    name: username,
    profileUrl: `https://www.codechef.com/users/${handle}`,
    headline: stats([
      ['Rating', number(/class="rating-number">\s*(\d+)/)],
      ['Highest', number(/Highest Rating (\d+)/)],
      ['Stars', stars ? `${stars}★` : null],
      ['Global rank', globalRank?.[1]],
      ['Contests', jsonVar('all_rating').length],
    ]),
    solved: { total: number(/Total Problems Solved: (\d+)/) ?? 0, breakdown: [] },
    badges: [...html.matchAll(/class=['"]badge__title['"]>([^<]+)</g)].map((match) => ({
      name: match[1].trim(),
    })),
    topics: [],
    calendar,
    notes: ['Read from the public profile page (CodeChef has no API). No topic-wise data.'],
  };
}

// -------------------------------------------------------------------------

const ADAPTERS: Record<PlatformId, (username: string) => Promise<AdapterResult>> = {
  leetcode,
  codeforces,
  github,
  geeksforgeeks,
  hackerrank,
  codechef,
};

export async function fetchCodingProfile(
  platform: PlatformId,
  username: string
): Promise<CodingProfile> {
  const handle = username.trim();
  return { platform, username: handle, ...(await ADAPTERS[platform](handle)) };
}
