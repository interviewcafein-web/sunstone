// Lightweight per-platform numbers for the students table. The full adapters make several
// calls per profile; a table of every student cannot afford that, so each summary here is
// one call (two for Codeforces and HackerRank, the latter side by side) and goes
// through a per-platform limiter.

import { postJson, request } from './adapters';
import { ProfileError, type PlatformId } from './types';

export interface PlatformSummary {
  /** Problems solved; for GitHub, contributions in the last year. */
  value: number;
  /** Secondary figure shown under the value, e.g. a contest rating. */
  detail?: string;
  /**
   * Latest day with any activity (YYYY-MM-DD, UTC). Missing when the platform's activity
   * calendar could not be read.
   */
  lastActive?: string;
  /**
   * Activity (submissions; contributions on GitHub) in each of the last WEEKS completed weeks,
   * Monday to Sunday UTC, oldest first. Missing in summaries saved before it was added.
   */
  weeks?: number[];
}

const isoDay = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);
const latest = (days: string[]) => (days.length ? days.sort().at(-1) : undefined);

export const WEEKS = 8;
const WEEK_MS = 7 * 86_400_000;

/** Sums daily counts (YYYY-MM-DD → count) into the last WEEKS completed weeks, oldest first. */
function weeklyActivity(days: Iterable<[string, number]>): number[] {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const thisMonday = today - ((now.getUTCDay() + 6) % 7) * 86_400_000;
  const start = thisMonday - WEEKS * WEEK_MS;
  const weeks: number[] = Array(WEEKS).fill(0);
  for (const [day, count] of days) {
    const time = Date.parse(`${day}T00:00:00Z`);
    if (time >= start && time < thisMonday && count > 0) {
      weeks[Math.floor((time - start) / WEEK_MS)] += count;
    }
  }
  return weeks;
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
  matchedUser(username: $u) { submissionCalendar submitStatsGlobal { acSubmissionNum { difficulty count } } }
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
    const calendar: Record<string, number> = JSON.parse(user.submissionCalendar || '{}');
    const active = Object.keys(calendar).filter((seconds) => calendar[seconds] > 0);
    return {
      value: all?.count ?? 0,
      detail: rating ? `Rating ${Math.round(rating)}` : undefined,
      lastActive: active.length ? isoDay(Math.max(...active.map(Number))) : undefined,
      weeks: weeklyActivity(
        Object.entries(calendar).map(([seconds, count]) => [isoDay(Number(seconds)), count])
      ),
    };
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
    return {
      value: solved.size,
      detail: info.rating ? `Rating ${info.rating}` : undefined,
      // user.status lists the newest submission first.
      lastActive: submissions[0] ? isoDay(submissions[0].creationTimeSeconds) : undefined,
      weeks: weeklyActivity(
        submissions.map((submission): [string, number] => [
          isoDay(submission.creationTimeSeconds),
          1,
        ])
      ),
    };
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
    const activeDays = [
      ...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="[1-4]"/g),
    ];
    // Each day's count is in a tooltip tied to the day's cell by id.
    const dateById = new Map<string, string>();
    for (const cell of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"/g)) {
      dateById.set(cell[2], cell[1]);
    }
    const counts: [string, number][] = [];
    for (const tip of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>\s*(\d+) contributions?/g)) {
      const day = dateById.get(tip[1]);
      if (day) counts.push([day, Number(tip[2])]);
    }
    return {
      value: Number(match[1].replace(/,/g, '')),
      lastActive: latest(activeDays.map((day) => day[1])),
      weeks: weeklyActivity(counts),
    };
  },

  // GeeksforGeeks' submissions calendar refuses relayed requests (HTTP 406), so it has no
  // weekly activity here and the table shows its comparison bar instead.
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
    const base = `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(handle)}`;
    const [payload, history] = await Promise.all([
      request(`${base}/badges`),
      request<Record<string, number>>(`${base}/submission_histories`).catch(() => null),
    ]);
    const badges: any[] = payload.models || [];
    const stars = badges.reduce((sum, badge) => sum + (badge.stars || 0), 0);
    return {
      value: badges.reduce((sum, badge) => sum + (badge.solved || 0), 0),
      detail: stars ? `${stars}★` : undefined,
      lastActive: history
        ? latest(Object.keys(history).filter((day) => Number(history[day]) > 0))
        : undefined,
      weeks: history
        ? weeklyActivity(Object.entries(history).map(([day, count]) => [day, Number(count)]))
        : undefined,
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
    const daily = html.match(/userDailySubmissionsStats = (\[.*?\]);/s);
    let days: [string, number][] | undefined;
    try {
      days = (JSON.parse(daily?.[1] ?? '[]') as { date: string; value: number }[]).map(
        (entry): [string, number] => [
          entry.date
            .split('-')
            .map((part, index) => (index ? part.padStart(2, '0') : part))
            .join('-'),
          Number(entry.value),
        ]
      );
    } catch {
      // Markup changed: no last-active date or weekly activity from CodeChef.
    }
    return {
      value: solved ? Number(solved[1]) : 0,
      detail: rating && Number(rating[1]) ? `Rating ${rating[1]}` : undefined,
      lastActive: latest((days ?? []).filter(([, count]) => count > 0).map(([day]) => day)),
      weeks: days ? weeklyActivity(days) : undefined,
    };
  },
};

export function fetchPlatformSummary(
  platform: PlatformId,
  handle: string
): Promise<PlatformSummary> {
  return LIMITERS[platform](() => SUMMARIES[platform](handle));
}
