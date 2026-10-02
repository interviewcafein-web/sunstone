// Lightweight per-platform numbers for the students table. The full adapters make several
// calls per profile; a table of every student cannot afford that, so each summary here is
// one call (two for Codeforces) and goes through a per-platform limiter.

import { postJson, request } from './adapters';
import { ProfileError, type PlatformId } from './types';

export interface PlatformSummary {
  /** Problems solved; for GitHub, contributions in the last year. */
  value: number;
  /** Secondary figure shown under the value, e.g. a contest rating. */
  detail?: string;
}

/** Runs at most `concurrency` tasks at once, starting them at least `gapMs` apart. */
function createLimiter(concurrency: number, gapMs = 0) {
  let active = 0;
  let lastStart = 0;
  const waiting: (() => void)[] = [];

  const next = () => {
    if (active >= concurrency || waiting.length === 0) return;
    active += 1;
    const start = waiting.shift()!;
    const delay = Math.max(0, lastStart + gapMs - Date.now());
    lastStart = Date.now() + delay;
    setTimeout(start, delay);
  };

  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      });
      next();
    });
}

const LIMITERS: Record<PlatformId, ReturnType<typeof createLimiter>> = {
  leetcode: createLimiter(3),
  // The Codeforces API throttles bursts from one IP.
  codeforces: createLimiter(1, 700),
  github: createLimiter(3),
  geeksforgeeks: createLimiter(3),
  hackerrank: createLimiter(3),
  // CodeChef rate-limits after roughly ten page loads in quick succession.
  codechef: createLimiter(1, 3000),
};

const LEETCODE_QUERY = `
query summary($u: String!) {
  matchedUser(username: $u) { submitStatsGlobal { acSubmissionNum { difficulty count } } }
  userContestRanking(username: $u) { rating }
}`;

const SUMMARIES: Record<PlatformId, (handle: string) => Promise<PlatformSummary>> = {
  async leetcode(handle) {
    const payload = await request('https://leetcode.com/graphql', {
      init: postJson({ query: LEETCODE_QUERY, variables: { u: handle } }),
    });
    const user = payload?.data?.matchedUser;
    if (!user) throw new ProfileError('not_found', 'User not found.');
    const all = user.submitStatsGlobal.acSubmissionNum.find((row: any) => row.difficulty === 'All');
    const rating = payload.data.userContestRanking?.rating;
    return { value: all?.count ?? 0, detail: rating ? `Rating ${Math.round(rating)}` : undefined };
  },

  async codeforces(handle) {
    const call = async (method: string, query: string) => {
      const payload = await request(`https://codeforces.com/api/${method}?${query}`, {
        direct: true,
        notFound: [400, 404],
      });
      if (payload.status !== 'OK') throw new ProfileError('upstream', payload.comment || 'Error');
      return payload.result;
    };
    const encoded = encodeURIComponent(handle);
    const [info] = await call('user.info', `handles=${encoded}`);
    const submissions: any[] = await call('user.status', `handle=${encoded}`);
    const solved = new Set(
      submissions
        .filter((submission) => submission.verdict === 'OK')
        .map(({ problem }) => `${problem.contestId ?? problem.problemsetName}-${problem.index}`)
    );
    return { value: solved.size, detail: info.rating ? `Rating ${info.rating}` : undefined };
  },

  // Read from GitHub's own contributions page: api.github.com allows only 60
  // unauthenticated requests an hour per IP, which a full table would exhaust.
  async github(handle) {
    const html = await request<string>(
      `https://github.com/users/${encodeURIComponent(handle)}/contributions`,
      { as: 'text' }
    );
    const match = html.match(/([\d,]+)\s+contributions?\s+in the last year/);
    if (!match) throw new ProfileError('upstream', 'Could not read the contributions page.');
    return { value: Number(match[1].replace(/,/g, '')) };
  },

  async geeksforgeeks(handle) {
    const payload = await request(
      `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${encodeURIComponent(handle)}`,
      { notFound: [400, 404] }
    );
    const info = payload.data;
    return {
      value: info.total_problems_solved ?? 0,
      detail: info.score ? `Score ${info.score}` : undefined,
    };
  },

  async hackerrank(handle) {
    const payload = await request(
      `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(handle)}/badges`
    );
    const badges: any[] = payload.models || [];
    const stars = badges.reduce((sum, badge) => sum + (badge.stars || 0), 0);
    return {
      value: badges.reduce((sum, badge) => sum + (badge.solved || 0), 0),
      detail: stars ? `${stars}★` : undefined,
    };
  },

  async codechef(handle) {
    const html = await request<string>(
      `https://www.codechef.com/users/${encodeURIComponent(handle)}`,
      { as: 'text' }
    );
    if (!html.includes('rating-number')) throw new ProfileError('not_found', 'User not found.');
    const solved = html.match(/Total Problems Solved: (\d+)/);
    const rating = html.match(/class="rating-number">\s*(\d+)/);
    return {
      value: solved ? Number(solved[1]) : 0,
      detail: rating && Number(rating[1]) ? `Rating ${rating[1]}` : undefined,
    };
  },
};

export function fetchPlatformSummary(
  platform: PlatformId,
  handle: string
): Promise<PlatformSummary> {
  return LIMITERS[platform](() => SUMMARIES[platform](handle));
}
