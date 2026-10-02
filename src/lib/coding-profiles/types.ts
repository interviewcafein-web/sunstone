export type PlatformId =
  | 'leetcode'
  | 'codeforces'
  | 'github'
  | 'geeksforgeeks'
  | 'hackerrank'
  | 'codechef';

export type Handles = Partial<Record<PlatformId, string>>;

export interface Platform {
  id: PlatformId;
  name: string;
  placeholder: string;
  /** True when the platform sends CORS headers, so the browser can call it without the relay. */
  direct: boolean;
  profileUrl: (handle: string) => string;
}

export interface Stat {
  label: string;
  value: string | number;
}

export interface CountItem {
  label: string;
  count: number;
}

export interface Badge {
  name: string;
  icon?: string;
}

export interface CodingProfile {
  platform: PlatformId;
  username: string;
  name: string;
  avatar?: string;
  profileUrl: string;
  headline: Stat[];
  /** Null for platforms with no notion of solved problems (GitHub). */
  solved: { total: number; breakdown: CountItem[] } | null;
  badges: Badge[];
  topics: CountItem[];
  topicsLabel?: string;
  /** ISO day (YYYY-MM-DD, UTC) to submission count. */
  calendar: Record<string, number>;
  notes: string[];
}

export type ProfileErrorKind = 'not_found' | 'network' | 'rate_limited' | 'upstream' | 'relay';

export class ProfileError extends Error {
  constructor(
    public kind: ProfileErrorKind,
    message: string
  ) {
    super(message);
  }
}
