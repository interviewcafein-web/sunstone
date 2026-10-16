// One adapter per platform: fetch a public profile by username and normalize it into a
// CodingProfile. Codeforces and the GitHub REST API are called straight from the browser;
// the rest send no CORS headers, so they go through the same-origin relay (api/relay.ts).
//
// What each adapter collects mirrors InterviewCafe's backend fetchers
// (backend/app/users/services/*_fetcher.py), minus anything that needs a secret.

import { streaksOf } from './activity';
import {
  ProfileError,
  type Award,
  type CodingProfile,
  type ContestPoint,
  type CountItem,
  type DifficultyRow,
  type PlatformId,
  type RecentItem,
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

// ------------------------------------------------------------------ helpers

export const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#10B981',
  Medium: '#F59E0B',
  Hard: '#EF4444',
  Basic: '#38BDF8',
  School: '#A78BFA',
};

const dayFromSeconds = (seconds: number | string) =>
  new Date(Number(seconds) * 1000).toISOString().slice(0, 10);

const padDay = (value: string) =>
  value
    .split('-')
    .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
    .join('-');

/** "2026-04-30 22:00:08" in India time to Unix seconds. */
const istToSeconds = (value: string) =>
  Math.floor(Date.parse(`${value.replace(' ', 'T')}+05:30`) / 1000) || 0;

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

const percent = (part: number, whole: number) =>
  whole ? Math.round((part / whole) * 1000) / 10 : undefined;

const titleCase = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase());

const fmt = (value: number) => value.toLocaleString('en-IN');

const LANGUAGE_NAMES: Record<string, string> = {
  cpp: 'C++',
  'c++': 'C++',
  c: 'C',
  java: 'Java',
  python: 'Python',
  python3: 'Python',
  pypy: 'Python',
  javascript: 'JavaScript',
  js: 'JavaScript',
  csharp: 'C#',
  kotlin: 'Kotlin',
  golang: 'Go',
  go: 'Go',
  rust: 'Rust',
  typescript: 'TypeScript',
};

/** "GNU G++17 7.3.0" → "C++", "PyPy 3-64" → "Python", "cpp" → "C++". */
function languageFamily(raw: string): string {
  const lower = raw.toLowerCase();
  if (/g\+\+|clang|c\+\+|msvc|cpp/.test(lower)) return 'C++';
  if (/pypy|python/.test(lower)) return 'Python';
  if (/java(?!script)/.test(lower)) return 'Java';
  if (/kotlin/.test(lower)) return 'Kotlin';
  if (/javascript|node/.test(lower)) return 'JavaScript';
  if (/c#|mono|\.net/.test(lower)) return 'C#';
  if (/rust/.test(lower)) return 'Rust';
  if (/\bgo\b|golang/.test(lower)) return 'Go';
  if (/gnu c\d*|^c\d*$|^c$/.test(lower)) return 'C';
  return LANGUAGE_NAMES[lower] ?? raw;
}

const VERDICTS: Record<string, string> = {
  OK: 'Accepted',
  WRONG_ANSWER: 'Wrong Answer',
  TIME_LIMIT_EXCEEDED: 'Time Limit Exceeded',
  MEMORY_LIMIT_EXCEEDED: 'Memory Limit Exceeded',
  RUNTIME_ERROR: 'Runtime Error',
  COMPILATION_ERROR: 'Compilation Error',
  PARTIAL: 'Partial',
  SKIPPED: 'Skipped',
  CHALLENGED: 'Hacked',
  IDLENESS_LIMIT_EXCEEDED: 'Idleness Limit Exceeded',
};

function streakKpiHint(calendar: Record<string, number>) {
  const { activeDays, best } = streaksOf(calendar);
  return `${fmt(activeDays)} active days · best streak ${best}`;
}

// ---------------------------------------------------------------- LeetCode

const LEETCODE_QUERY = `
query profile($u: String!) {
  matchedUser(username: $u) {
    username
    submissionCalendar
    profile { ranking userAvatar realName countryName }
    submitStatsGlobal {
      acSubmissionNum { difficulty count submissions }
      totalSubmissionNum { difficulty count submissions }
    }
    badges { displayName icon creationDate }
    tagProblemCounts {
      advanced { tagName problemsSolved }
      intermediate { tagName problemsSolved }
      fundamental { tagName problemsSolved }
    }
    languageProblemCount { languageName problemsSolved }
  }
  userContestRanking(username: $u) {
    rating attendedContestsCount globalRanking topPercentage badge { name }
  }
  userContestRankingHistory(username: $u) {
    attended rating ranking contest { title startTime }
  }
  recentSubmissionList(username: $u, limit: 15) { title titleSlug timestamp statusDisplay lang }
  allQuestionsCount { difficulty count }
}`;

async function leetcode(username: string): Promise<AdapterResult> {
  const payload = await request('https://leetcode.com/graphql', {
    init: postJson({ query: LEETCODE_QUERY, variables: { u: username } }),
  });
  const data = payload?.data ?? {};
  const user = data.matchedUser;
  if (!user) throw new ProfileError('not_found', 'User not found.');

  const byDifficulty = (list: any[]) =>
    Object.fromEntries((list ?? []).map((row: any) => [row.difficulty, row]));
  const accepted = byDifficulty(user.submitStatsGlobal?.acSubmissionNum);
  const attempted = byDifficulty(user.submitStatsGlobal?.totalSubmissionNum);
  const available = Object.fromEntries(
    (data.allQuestionsCount ?? []).map((row: any) => [row.difficulty, row.count])
  );

  const rows: DifficultyRow[] = ['Easy', 'Medium', 'Hard'].map((label) => ({
    label,
    solved: accepted[label]?.count ?? 0,
    color: DIFFICULTY_COLORS[label],
    total: available[label],
    attempted: attempted[label]?.count,
    acceptance: percent(accepted[label]?.submissions ?? 0, attempted[label]?.submissions ?? 0),
  }));
  const solved = accepted.All?.count ?? 0;
  const totalSubmissions = attempted.All?.submissions ?? 0;
  const acceptance = percent(accepted.All?.submissions ?? 0, totalSubmissions);

  const tags: Record<string, number> = {};
  for (const level of Object.values<any[]>(user.tagProblemCounts || {})) {
    for (const tag of level || []) tags[tag.tagName] = tag.problemsSolved;
  }

  const calendar: Record<string, number> = {};
  const rawCalendar = JSON.parse(user.submissionCalendar || '{}');
  for (const [seconds, count] of Object.entries<number>(rawCalendar)) {
    addDay(calendar, dayFromSeconds(seconds), count);
  }

  const contest = data.userContestRanking;
  // Ranking 0 is LeetCode's placeholder before a first contest; skip it.
  const history: ContestPoint[] = (data.userContestRankingHistory ?? [])
    .filter((entry: any) => entry.attended && entry.ranking > 0)
    .map((entry: any) => ({
      time: entry.contest.startTime,
      rating: Math.round(entry.rating),
      title: entry.contest.title,
      rank: entry.ranking,
    }));
  const maxRating = history.length ? Math.max(...history.map((point) => point.rating)) : null;

  const recent: RecentItem[] = (data.recentSubmissionList ?? []).map((item: any) => ({
    title: item.title,
    url: `https://leetcode.com/problems/${item.titleSlug}/`,
    time: Number(item.timestamp),
    status: item.statusDisplay,
    language: languageFamily(item.lang ?? ''),
  }));

  return {
    name: user.profile?.realName || user.username,
    avatar: user.profile?.userAvatar,
    profileUrl: `https://leetcode.com/u/${encodeURIComponent(user.username)}/`,
    rankTitle: contest?.badge?.name,
    solved,
    kpis: [
      {
        label: 'Problems solved',
        value: solved,
        hint: available.All ? `of ${fmt(available.All)}` : undefined,
      },
      {
        label: 'Contest rating',
        value: contest?.attendedContestsCount ? Math.round(contest.rating) : null,
        hint: contest?.attendedContestsCount
          ? `Top ${contest.topPercentage}%`
          : 'No rated contests yet',
      },
      {
        label: 'Global rank',
        value: user.profile?.ranking ?? null,
        hint: contest?.globalRanking ? `Contest #${fmt(contest.globalRanking)}` : undefined,
      },
      {
        label: 'Acceptance',
        value: acceptance !== undefined ? `${acceptance}%` : null,
        hint: `${fmt(totalSubmissions)} submissions`,
      },
    ],
    difficulty: [{ title: 'Solved by difficulty', rows }],
    rating: contest?.attendedContestsCount
      ? {
          current: Math.round(contest.rating),
          max: maxRating,
          contests: contest.attendedContestsCount,
          history,
        }
      : null,
    ratingDistribution: [],
    topics: topN(tags),
    languages: topN(
      Object.fromEntries(
        (user.languageProblemCount ?? []).map((row: any) => [row.languageName, row.problemsSolved])
      ),
      8
    ),
    languagesLabel: 'Problems solved by language',
    badges: (user.badges || []).map((badge: any) => ({
      name: badge.displayName,
      icon: badge.icon?.startsWith('/') ? `https://leetcode.com${badge.icon}` : badge.icon,
      detail: badge.creationDate,
    })),
    certificates: [],
    repos: [],
    recent,
    recentKind: 'all',
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

const CF_BANDS: { label: string; below: number; color: string }[] = [
  { label: 'Under 1200', below: 1200, color: '#9CA3AF' },
  { label: '1200–1599', below: 1600, color: '#10B981' },
  { label: '1600–1999', below: 2000, color: '#3B82F6' },
  { label: '2000+', below: Infinity, color: '#A855F7' },
];

async function codeforces(username: string): Promise<AdapterResult> {
  const handle = encodeURIComponent(username);
  // Sequential on purpose: the API throttles bursts from one IP.
  const [info] = await codeforcesCall('user.info', `handles=${handle}`);
  const submissions: any[] = await codeforcesCall('user.status', `handle=${handle}`);
  const contests: any[] = await codeforcesCall('user.rating', `handle=${handle}`);

  const solved = new Map<string, any>();
  const solvedLanguage = new Map<string, string>();
  const calendar: Record<string, number> = {};
  let acceptedCount = 0;
  for (const submission of submissions) {
    addDay(calendar, dayFromSeconds(submission.creationTimeSeconds));
    if (submission.verdict !== 'OK') continue;
    acceptedCount += 1;
    const problem = submission.problem;
    const key = `${problem.contestId ?? problem.problemsetName}-${problem.index}`;
    solved.set(key, problem);
    solvedLanguage.set(key, languageFamily(submission.programmingLanguage ?? ''));
  }

  const tags: Record<string, number> = {};
  const byRating: Record<number, number> = {};
  const bands = CF_BANDS.map((band) => ({ ...band, solved: 0 }));
  for (const problem of solved.values()) {
    for (const tag of problem.tags || []) tags[tag] = (tags[tag] || 0) + 1;
    if (!problem.rating) continue;
    byRating[problem.rating] = (byRating[problem.rating] || 0) + 1;
    bands.find((band) => problem.rating < band.below)!.solved += 1;
  }
  const languages: Record<string, number> = {};
  for (const language of solvedLanguage.values()) {
    languages[language] = (languages[language] || 0) + 1;
  }

  const history: ContestPoint[] = contests.map((entry) => ({
    time: entry.ratingUpdateTimeSeconds,
    rating: entry.newRating,
    title: entry.contestName,
    rank: entry.rank,
  }));
  const bestRank = history.length ? Math.min(...history.map((point) => point.rank!)) : null;

  const recent: RecentItem[] = submissions.slice(0, 15).map((submission) => {
    const problem = submission.problem;
    return {
      title: `${problem.index}. ${problem.name}`,
      url: problem.contestId
        ? `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`
        : undefined,
      time: submission.creationTimeSeconds,
      status: VERDICTS[submission.verdict] ?? titleCase((submission.verdict ?? '').toLowerCase()),
      language: languageFamily(submission.programmingLanguage ?? ''),
    };
  });

  return {
    name: [info.firstName, info.lastName].filter(Boolean).join(' ') || info.handle,
    avatar: info.titlePhoto,
    profileUrl: `https://codeforces.com/profile/${encodeURIComponent(info.handle)}`,
    rankTitle: info.rank ? titleCase(info.rank) : undefined,
    solved: solved.size,
    kpis: [
      {
        label: 'Problems solved',
        value: solved.size,
        hint: `${fmt(submissions.length)} submissions · ${percent(acceptedCount, submissions.length) ?? 0}% accepted`,
      },
      {
        label: 'Rating',
        value: info.rating ?? null,
        hint: info.rank ? titleCase(info.rank) : 'Unrated',
      },
      {
        label: 'Max rating',
        value: info.maxRating ?? null,
        hint: info.maxRank ? titleCase(info.maxRank) : undefined,
      },
      {
        label: 'Contests',
        value: contests.length,
        hint: bestRank ? `Best rank #${fmt(bestRank)}` : undefined,
      },
    ],
    difficulty: [
      {
        title: 'Solved by problem rating',
        rows: bands.map(({ label, solved: count, color }) => ({ label, solved: count, color })),
      },
    ],
    rating: history.length
      ? {
          current: info.rating ?? null,
          max: info.maxRating ?? null,
          contests: history.length,
          history,
        }
      : null,
    ratingDistribution: Object.entries(byRating)
      .map(([rating, count]) => ({ label: rating, count }))
      .sort((a, b) => Number(a.label) - Number(b.label)),
    topics: topN(tags),
    languages: topN(languages, 8),
    languagesLabel: 'Problems solved by language',
    badges: [],
    certificates: [],
    repos: [],
    recent,
    recentKind: 'all',
    calendar,
    notes: [],
  };
}

// ------------------------------------------------------------------ GitHub

/** Reads the public contributions graph that github.com renders for every user. */
async function githubCalendar(login: string) {
  const html = await request<string>(
    `https://github.com/users/${encodeURIComponent(login)}/contributions`,
    { as: 'text' }
  );
  const dateById = new Map<string, string>();
  for (const match of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"/g)) {
    dateById.set(match[2], match[1]);
  }
  const calendar: Record<string, number> = {};
  for (const match of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>\s*(\d+) contributions?/g)) {
    const day = dateById.get(match[1]);
    if (day) calendar[day] = Number(match[2]);
  }
  const total = html.match(/([\d,]+)\s+contributions?\s+in the last year/);
  return { calendar, total: total ? Number(total[1].replace(/,/g, '')) : null };
}

async function github(username: string): Promise<AdapterResult> {
  const login = encodeURIComponent(username);
  const user = await request(`https://api.github.com/users/${login}`, { direct: true });
  const [repos, contributions] = await Promise.all([
    request<any[]>(`https://api.github.com/users/${login}/repos?per_page=100&sort=pushed`, {
      direct: true,
    }),
    githubCalendar(user.login).catch(() => null),
  ]);

  const own = repos.filter((repo) => !repo.fork);
  const stars = own.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const languages: Record<string, number> = {};
  for (const repo of own) {
    if (repo.language) languages[repo.language] = (languages[repo.language] || 0) + 1;
  }
  const calendar = contributions?.calendar ?? {};
  const { best, current } = streaksOf(calendar);

  const notes = ['GitHub achievements and private contributions are not public.'];
  if (!contributions) notes.push('The contribution calendar could not be loaded.');
  if (user.public_repos > repos.length) notes.push('Repo stats cover the 100 most recent repos.');

  return {
    name: user.name || user.login,
    avatar: user.avatar_url,
    profileUrl: user.html_url,
    solved: null,
    kpis: [
      {
        label: 'Contributions',
        value: contributions?.total ?? null,
        hint: 'last 12 months',
      },
      { label: 'Public repos', value: user.public_repos, hint: `${fmt(stars)} stars` },
      { label: 'Followers', value: user.followers, hint: `following ${fmt(user.following)}` },
      { label: 'Best streak', value: `${best}d`, hint: `current ${current}d` },
    ],
    difficulty: [],
    rating: null,
    ratingDistribution: [],
    topics: [],
    languages: topN(languages, 8),
    languagesLabel: 'Repos by language',
    badges: [],
    certificates: [],
    repos: [...own]
      .sort(
        (a, b) =>
          b.stargazers_count - a.stargazers_count ||
          Date.parse(b.pushed_at) - Date.parse(a.pushed_at)
      )
      .slice(0, 6)
      .map((repo) => ({
        name: repo.name,
        description: repo.description ?? undefined,
        url: repo.html_url,
        stars: repo.stargazers_count,
        language: repo.language ?? undefined,
      })),
    recent: [],
    recentKind: 'all',
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

  const lists: Record<string, Record<string, any>> = solvedLists.result || {};
  const count = (label: string) => Object.keys(lists[label] || {}).length;
  const languages: Record<string, number> = {};
  const recent: RecentItem[] = [];
  for (const [difficulty, problems] of Object.entries(lists)) {
    for (const problem of Object.values<any>(problems)) {
      const language = languageFamily(problem.lang ?? '');
      languages[language] = (languages[language] || 0) + 1;
      recent.push({
        title: problem.pname,
        url: `https://www.geeksforgeeks.org/problems/${problem.slug}/1`,
        time: istToSeconds(problem.user_subtime ?? ''),
        difficulty,
        language,
      });
    }
  }
  recent.sort((a, b) => b.time - a.time);

  const row = (label: string) => ({ label, solved: count(label), color: DIFFICULTY_COLORS[label] });

  return {
    name: info.name || username,
    avatar: info.profile_image_url,
    profileUrl: `https://www.geeksforgeeks.org/profile/${encodeURIComponent(username)}`,
    solved: info.total_problems_solved ?? 0,
    kpis: [
      {
        label: 'Problems solved',
        value: info.total_problems_solved ?? 0,
        hint: streakKpiHint(calendar),
      },
      {
        label: 'Coding score',
        value: info.score ?? null,
        hint: `Monthly ${fmt(info.monthly_score ?? 0)}`,
      },
      {
        label: 'Institute rank',
        value: info.institute_rank || null,
        hint: info.institute_name ?? undefined,
      },
      {
        label: 'POTD streak',
        value: info.pod_solved_longest_streak ?? null,
        hint: `current ${info.pod_solved_current_streak ?? 0}`,
      },
    ],
    difficulty: [
      { title: 'Fundamentals', rows: [row('School'), row('Basic')] },
      { title: 'DSA problems solved', rows: [row('Easy'), row('Medium'), row('Hard')] },
    ],
    rating: null,
    ratingDistribution: [],
    topics: [],
    languages: topN(languages, 8),
    languagesLabel: 'Problems solved by language',
    badges: [],
    certificates: [],
    repos: [],
    recent: recent.slice(0, 15),
    recentKind: 'solved',
    calendar,
    notes: ['GeeksforGeeks no longer publishes topic-wise counts without a login.'],
  };
}

// -------------------------------------------------------------- HackerRank

async function hackerrank(username: string): Promise<AdapterResult> {
  const handle = encodeURIComponent(username);
  const base = 'https://www.hackerrank.com/rest';
  const profile = await request(`${base}/contests/master/hackers/${handle}/profile`);
  const [badgeData, history, certificates, recent] = await Promise.all([
    request(`${base}/hackers/${handle}/badges`).catch(() => ({ models: [] })),
    request<Record<string, number>>(`${base}/hackers/${handle}/submission_histories`).catch(
      () => ({})
    ),
    request(
      `https://www.hackerrank.com/community/v1/test_results/hacker_certificate?username=${handle}`
    ).catch(() => ({ data: [] })),
    request(`${base}/hackers/${handle}/recent_challenges?limit=15&response_version=v2`).catch(
      () => ({ models: [] })
    ),
  ]);

  const model = profile.model;
  const badges: any[] = badgeData.models || [];
  const calendar: Record<string, number> = {};
  for (const [day, count] of Object.entries(history)) {
    if (Number(count) > 0) addDay(calendar, day, Number(count));
  }
  const solved = badges.reduce((sum, badge) => sum + (badge.solved || 0), 0);
  const stars = badges.reduce((sum, badge) => sum + (badge.stars || 0), 0);
  const passed = (certificates.data ?? []).filter(
    (entry: any) => entry.attributes?.status === 'test_passed'
  );

  return {
    name: model.name || model.username,
    avatar: model.avatar,
    profileUrl: `https://www.hackerrank.com/profile/${encodeURIComponent(model.username)}`,
    solved,
    kpis: [
      { label: 'Problems solved', value: solved, hint: 'across skill tracks' },
      { label: 'Badges', value: badges.length, hint: `${stars}★ in total` },
      { label: 'Certificates', value: passed.length, hint: 'verified' },
      {
        label: 'Active days',
        value: streaksOf(calendar).activeDays,
        hint: model.country || undefined,
      },
    ],
    difficulty: [],
    rating: null,
    ratingDistribution: [],
    topics: topN(Object.fromEntries(badges.map((badge) => [badge.badge_name, badge.solved || 0]))),
    topicsLabel: 'Problems solved by skill',
    languages: [],
    badges: badges.map(
      (badge): Award => ({
        name: badge.badge_name,
        stars: badge.stars || 0,
        detail: `${badge.stars}/${badge.total_stars}★ · ${badge.solved} solved`,
      })
    ),
    certificates: passed.map((entry: any) => ({
      name:
        entry.attributes.certificates?.[0] ??
        `${entry.attributes.certificate?.label} (${entry.attributes.certificate?.level})`,
      url: `https://www.hackerrank.com/certificates/${entry.id}`,
      completedAt: entry.attributes.completed_at
        ? Math.floor(Date.parse(entry.attributes.completed_at) / 1000)
        : undefined,
    })),
    repos: [],
    recent: (recent.models ?? []).map((item: any) => ({
      title: item.name,
      url: item.url ? `https://www.hackerrank.com${item.url}` : undefined,
      time: Math.floor(Date.parse(item.created_at) / 1000),
    })),
    recentKind: 'solved',
    calendar,
    notes: ['Solved count is the sum across skill tracks; HackerRank has no single total.'],
  };
}

// ---------------------------------------------------------------- CodeChef

const CODECHEF_STATUS: [RegExp, string][] = [
  [/accepted/i, 'Accepted'],
  [/partial/i, 'Partial'],
  [/wrong/i, 'Wrong Answer'],
  [/time/i, 'Time Limit Exceeded'],
  [/runtime/i, 'Runtime Error'],
  [/compil/i, 'Compilation Error'],
];

/** CodeChef's recent-submissions widget: JSON wrapping an HTML table. */
async function codechefRecent(handle: string): Promise<RecentItem[]> {
  const payload = await request(
    `https://www.codechef.com/recent/user?page=0&user_handle=${encodeURIComponent(handle)}`
  );
  const rows = String(payload.content ?? '').match(/<tr\s*>[\s\S]*?<\/tr>/g) ?? [];
  const now = Math.floor(Date.now() / 1000);
  return rows.flatMap((row) => {
    const problem = row.match(/<a href='([^']+)'[^>]*>([^<]+)<\/a>/);
    if (!problem) return [];
    const statusTitle = row.match(/<span title='([^']*)'/)?.[1] ?? '';
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]);
    const when = row.match(/<td title='([^']+)'/)?.[1] ?? '';
    return [
      {
        title: problem[2].trim(),
        url: `https://www.codechef.com${problem[1]}`,
        time: relativeToSeconds(when, now),
        status: CODECHEF_STATUS.find(([pattern]) => pattern.test(statusTitle))?.[1] ?? statusTitle,
        language: cells[3]?.replace(/<[^>]+>/g, '').trim() || undefined,
      },
    ];
  });
}

/** "14 hours ago" or "10:24 PM 05/06/26" (India time) to Unix seconds. */
function relativeToSeconds(value: string, now: number): number {
  const relative = value.match(/(\d+)\s+(sec|min|hour|day)/i);
  if (relative) {
    const unit = { sec: 1, min: 60, hour: 3600, day: 86400 }[
      relative[2].toLowerCase() as 'sec' | 'min' | 'hour' | 'day'
    ];
    return now - Number(relative[1]) * unit;
  }
  const absolute = value.match(/(\d+):(\d+)\s*(AM|PM)\s+(\d+)\/(\d+)\/(\d+)/i);
  if (!absolute) return now;
  const [, hours, minutes, meridiem, day, month, year] = absolute;
  const hour24 = (Number(hours) % 12) + (meridiem.toUpperCase() === 'PM' ? 12 : 0);
  return istToSeconds(
    `20${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${String(hour24).padStart(2, '0')}:${minutes}:00`
  );
}

// CodeChef has no public API: the profile page is scraped, so this adapter is the most
// fragile and will need fixing when the markup changes.
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
  const rank = (label: string) =>
    number(new RegExp(`<strong>\\s*(\\d+)\\s*</strong>\\s*</a>\\s*${label} Rank`));
  const division = html.match(/class="rating-number">\s*\d+\s*<\/div>\s*<div>\((Div \d)\)/)?.[1];
  const rating = number(/class="rating-number">\s*(\d+)/);
  const highest = number(/Highest Rating (\d+)/);
  const solved = number(/Total Problems Solved: (\d+)/) ?? 0;

  const calendar: Record<string, number> = {};
  for (const entry of jsonVar('userDailySubmissionsStats')) {
    if (entry?.date) addDay(calendar, padDay(String(entry.date)), Number(entry.value) || 0);
  }

  const history: ContestPoint[] = jsonVar('all_rating').map((entry: any) => ({
    time: istToSeconds(entry.end_date ?? ''),
    rating: Number(entry.rating),
    title: entry.name,
    rank: Number(entry.rank) || undefined,
  }));

  const badges: Award[] = [
    ...html.matchAll(
      /badge__image'>\s*<img src='([^']+)'[\s\S]*?badge__title'>([^<]+)<\/p>\s*<p class='badge__description'>([\s\S]*?)<\/p>/g
    ),
  ].map((match) => ({
    icon: match[1],
    name: match[2].trim(),
    detail: match[3]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  }));

  const recent = await codechefRecent(username).catch(() => []);

  return {
    name: username,
    profileUrl: `https://www.codechef.com/users/${handle}`,
    rankTitle: stars ? `${stars}★` : undefined,
    solved,
    kpis: [
      { label: 'Problems solved', value: solved, hint: `${history.length} rated contests` },
      { label: 'Rating', value: rating || null, hint: division },
      { label: 'Highest rating', value: highest || null, hint: stars ? `${stars}★` : undefined },
      {
        label: 'Global rank',
        value: rank('Global'),
        hint: rank('Country') ? `Country #${fmt(rank('Country')!)}` : 'Inactive in rated contests',
      },
    ],
    difficulty: [],
    rating: history.length
      ? { current: rating || null, max: highest || null, contests: history.length, history }
      : null,
    ratingDistribution: [],
    topics: [],
    languages: [],
    badges,
    certificates: [],
    repos: [],
    recent,
    recentKind: 'all',
    calendar,
    notes: ['Read from the public profile page; CodeChef has no API. No topic-wise data.'],
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
