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
  /** Brand colour, used for charts, tiles and the heatmap. */
  color: string;
  profileUrl: (handle: string) => string;
}

export interface Stat {
  label: string;
  value: string | number;
}

export interface CountItem {
  label: string;
  count: number;
  color?: string;
}

/** A headline tile: label, big value, and a one-line hint under it. */
export interface Kpi {
  label: string;
  value: string | number | null;
  hint?: string;
}

export interface DifficultyRow {
  label: string;
  solved: number;
  color: string;
  /** Problems available on the platform at this difficulty. */
  total?: number;
  /** Distinct problems tried, solved or not. */
  attempted?: number;
  /** Accepted submissions as a % of all submissions. */
  acceptance?: number;
}

export interface ContestPoint {
  /** Unix seconds. */
  time: number;
  rating: number;
  title: string;
  rank?: number;
}

export interface RecentItem {
  title: string;
  url?: string;
  /** Unix seconds. */
  time: number;
  status?: string;
  language?: string;
  difficulty?: string;
}

export interface Award {
  name: string;
  icon?: string;
  detail?: string;
  /** HackerRank-style star count, shown as a hexagon badge. */
  stars?: number;
}

export interface Certificate {
  name: string;
  /** HackerRank's two kinds: a skill test ("SQL (Advanced)") or a role ("Software Engineer"). */
  kind?: 'skill' | 'role';
  url?: string;
  /** Unix seconds. */
  completedAt?: number;
}

export interface Repo {
  name: string;
  description?: string;
  url: string;
  stars: number;
  language?: string;
}

export interface CodingProfile {
  platform: PlatformId;
  username: string;
  name: string;
  avatar?: string;
  profileUrl: string;
  /** Rank title shown as a pill next to the platform name, e.g. "Expert" or "3★". */
  rankTitle?: string;
  kpis: Kpi[];
  /** Problems solved; null for GitHub, which has no such notion. */
  solved: number | null;
  /** Groups of difficulty rows; GeeksforGeeks has two (fundamentals and DSA). */
  difficulty: { title: string; rows: DifficultyRow[] }[];
  rating: {
    current: number | null;
    max: number | null;
    contests: number;
    history: ContestPoint[];
  } | null;
  /** Codeforces: solved problems per problem rating. */
  ratingDistribution: CountItem[];
  topics: CountItem[];
  topicsLabel?: string;
  languages: CountItem[];
  languagesLabel?: string;
  badges: Award[];
  certificates: Certificate[];
  repos: Repo[];
  recent: RecentItem[];
  /** 'solved' when the platform only lists accepted problems. */
  recentKind: 'all' | 'solved';
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
