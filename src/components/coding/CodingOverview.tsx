import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Flame, Swords, Target, Trophy } from 'lucide-react';

import { ActivityHeatmap, BarList, Donut, RatingChart } from '@/components/coding/charts';
import { BadgeWall } from '@/components/coding/lists';
import { Card, CardHeader, Segmented, formatNumber } from '@/components/coding/ui';
import { PlatformLogo } from '@/components/profile/PlatformLogo';
import { DIFFICULTY_COLORS } from '@/lib/coding-profiles/adapters';
import { mergeCalendars, streaksOf } from '@/lib/coding-profiles/activity';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import type { CodingProfile, CountItem, PlatformId } from '@/lib/coding-profiles/types';

const OVERVIEW_COLOR = '#274f87';

const byPlatform = (profiles: CodingProfile[]) =>
  Object.fromEntries(profiles.map((profile) => [profile.platform, profile])) as Partial<
    Record<PlatformId, CodingProfile>
  >;

const solvedAt = (profile: CodingProfile | undefined, label: string) =>
  profile?.difficulty.flatMap((group) => group.rows).find((row) => row.label === label)?.solved ??
  0;

const platformOf = (id: PlatformId) => PLATFORMS.find((platform) => platform.id === id)!;

/** Cross-platform summary: the same sections as InterviewCafe's coding overview. */
export function CodingOverview({ profiles }: { profiles: CodingProfile[] }) {
  const map = byPlatform(profiles);
  const calendar = useMemo(
    () => mergeCalendars(profiles.map((profile) => profile.calendar)),
    [profiles]
  );
  const streaks = streaksOf(calendar);
  const solved = profiles.reduce((sum, profile) => sum + (profile.solved ?? 0), 0);
  const rated = profiles.filter((profile) => profile.rating);
  const contests = rated.reduce((sum, profile) => sum + profile.rating!.contests, 0);

  const distributions = [
    {
      title: 'DSA · By Difficulty',
      aside: 'LeetCode + GeeksforGeeks',
      rows: ['Easy', 'Medium', 'Hard'].map((label) => ({
        label,
        count: solvedAt(map.leetcode, label) + solvedAt(map.geeksforgeeks, label),
        color: DIFFICULTY_COLORS[label],
      })),
    },
    {
      title: 'Competitive Programming',
      aside: 'By Platform',
      rows: (['codeforces', 'codechef'] as PlatformId[]).map((id) => ({
        label: platformOf(id).name,
        count: map[id]?.solved ?? 0,
        color: platformOf(id).color,
      })),
    },
    {
      title: 'Fundamentals',
      aside: 'GeeksforGeeks + HackerRank',
      rows: [
        {
          label: 'School',
          count: solvedAt(map.geeksforgeeks, 'School'),
          color: DIFFICULTY_COLORS.School,
        },
        {
          label: 'Basic',
          count: solvedAt(map.geeksforgeeks, 'Basic'),
          color: DIFFICULTY_COLORS.Basic,
        },
        {
          label: 'HackerRank',
          count: map.hackerrank?.solved ?? 0,
          color: platformOf('hackerrank').color,
        },
      ],
    },
  ].filter((group) => group.rows.some((row) => row.count > 0));

  const topics = mergedTopics(map);
  const awards = profiles.flatMap((profile) => profile.badges);
  const certificates = profiles.reduce((sum, profile) => sum + profile.certificates.length, 0);

  return (
    <div className="rise-stagger space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-3">
          <OverviewTile
            icon={Target}
            tone="bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300"
            label="Total Solved"
            value={formatNumber(solved)}
          />
          <OverviewTile
            icon={Flame}
            tone="bg-orange-100 text-orange-600"
            label="Current Streak"
            value={`${streaks.current}d`}
          />
          <OverviewTile
            icon={Trophy}
            tone="bg-amber-100 text-amber-600"
            label="Best Streak"
            value={`${streaks.best}d`}
          />
          <OverviewTile
            icon={Swords}
            tone="bg-sky-100 text-sky-600"
            label="Contests"
            value={formatNumber(contests)}
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <ActivityHeatmap
            calendar={calendar}
            color={OVERVIEW_COLOR}
            noun="activities across platforms"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {distributions.length > 0 && (
            <Card>
              <CardHeader title="Question Distribution" />
              <div className="space-y-6">
                {distributions.map((group) => (
                  <Donut
                    key={group.title}
                    title={group.title}
                    aside={group.aside}
                    rows={group.rows}
                  />
                ))}
              </div>
            </Card>
          )}
          {topics.items.length > 0 && (
            <Card>
              <CardHeader title="Topics" aside={topics.source} />
              <BarList items={topics.items} color={OVERVIEW_COLOR} />
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {rated.length > 0 && <ContestsCard profiles={rated} />}
          {rated.some((profile) => profile.rating!.history.length > 1) && (
            <RatingHistoryCard profiles={rated} />
          )}
          {awards.length > 0 && (
            <Card>
              <CardHeader
                title="Badges & Awards"
                aside={`${awards.length} earned${certificates ? ` · ${certificates} certificate${certificates === 1 ? '' : 's'}` : ''}`}
              />
              <BadgeWall badges={awards.slice(0, 12)} compact />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
}) {
  return (
    <div className="shadow-card flex flex-col justify-between rounded-2xl border border-slate-200 bg-surface p-4">
      <span className={`flex size-9 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div className="mt-4">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

/** LeetCode topics, with "Arrays" and "Array" counted as one; Codeforces tags if none. */
function mergedTopics(map: Partial<Record<PlatformId, CodingProfile>>) {
  const sources = (['leetcode', 'geeksforgeeks'] as PlatformId[]).filter(
    (id) => map[id]?.topics.length
  );
  if (!sources.length && map.codeforces?.topics.length) {
    return { items: map.codeforces.topics.slice(0, 10), source: 'Codeforces tags' };
  }
  const merged = new Map<string, CountItem>();
  for (const id of sources) {
    for (const topic of map[id]!.topics) {
      const key = topic.label.toLowerCase().replace(/s$/, '');
      const existing = merged.get(key);
      merged.set(key, {
        label: existing?.label ?? topic.label,
        count: (existing?.count ?? 0) + topic.count,
      });
    }
  }
  return {
    items: [...merged.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    source: sources.map((id) => platformOf(id).name).join(' + '),
  };
}

function ContestsCard({ profiles }: { profiles: CodingProfile[] }) {
  const attended = profiles.reduce((sum, profile) => sum + profile.rating!.contests, 0);
  return (
    <Card>
      <CardHeader title="Contests & Ratings" aside={`${attended} attended`} />
      <ul className="divide-y divide-slate-100">
        {profiles.map((profile) => {
          const platform = platformOf(profile.platform);
          return (
            <li key={profile.platform} className="flex items-center gap-3 py-2.5">
              <PlatformLogo platform={profile.platform} className="size-6" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{platform.name}</p>
                <p className="text-xs text-slate-500">
                  {profile.rating!.contests} contests
                  {profile.rankTitle ? ` · ${profile.rankTitle}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold tabular-nums" style={{ color: platform.color }}>
                  {profile.rating!.current ? formatNumber(profile.rating!.current) : '—'}
                </p>
                {profile.rating!.max && (
                  <p className="text-xs text-slate-500">max {formatNumber(profile.rating!.max)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function RatingHistoryCard({ profiles }: { profiles: CodingProfile[] }) {
  const withHistory = profiles.filter((profile) => profile.rating!.history.length > 1);
  const defaultId = [...withHistory].sort((a, b) => b.rating!.contests - a.rating!.contests)[0]
    .platform;
  const [selected, setSelected] = useState<PlatformId>(defaultId);
  const profile = withHistory.find((item) => item.platform === selected) ?? withHistory[0];

  return (
    <Card>
      <CardHeader
        title="Rating History"
        aside={
          withHistory.length > 1 && (
            <Segmented
              label="Platform"
              value={profile.platform}
              onChange={setSelected}
              options={withHistory.map((item) => ({
                value: item.platform,
                label: (
                  <>
                    <PlatformLogo platform={item.platform} className="size-3.5" />
                    {platformOf(item.platform).name}
                  </>
                ),
              }))}
            />
          )
        }
      />
      <RatingChart history={profile.rating!.history} color={platformOf(profile.platform).color} />
    </Card>
  );
}
