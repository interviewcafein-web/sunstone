import { ExternalLink } from 'lucide-react';

import {
  ActivityHeatmap,
  ActivityWindows,
  BarList,
  DifficultyBreakdown,
  Donut,
  KpiGrid,
  RatingCard,
  RatingHistogram,
} from '@/components/coding/charts';
import {
  BadgeWall,
  CertificateCards,
  RecentTable,
  RepoCards,
  safeUrl,
} from '@/components/coding/lists';
import { Card, CardHeader } from '@/components/coding/ui';
import { PlatformLogo } from '@/components/profile/PlatformLogo';
import type { CodingProfile, Platform } from '@/lib/coding-profiles/types';

/** Everything known about one person on one platform, section by section. */
export function PlatformPanel({
  platform,
  profile,
}: {
  platform: Platform;
  profile: CodingProfile;
}) {
  const color = platform.color;
  const link = safeUrl(profile.profileUrl);
  const hasCalendar = Object.keys(profile.calendar).length > 0;
  const lists = [
    profile.topics.length > 0 && {
      title: profile.topicsLabel ?? 'Strongest topics',
      items: profile.topics.slice(0, 8),
    },
    profile.languages.length > 0 && {
      title: profile.languagesLabel ?? 'Languages',
      items: profile.languages,
    },
  ].filter(Boolean) as { title: string; items: typeof profile.topics }[];

  return (
    <div className="rise-stagger space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <PlatformLogo platform={platform.id} className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            {platform.name}
            {profile.rankTitle && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                style={{ background: color }}
              >
                {profile.rankTitle}
              </span>
            )}
          </h2>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-700 inline-flex items-center gap-1 text-sm text-slate-500"
            >
              @{profile.username}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </header>

      <KpiGrid kpis={profile.kpis} color={color} />

      {hasCalendar && <ActivityWindows calendar={profile.calendar} />}

      {platform.id === 'leetcode' && profile.difficulty[0] && (
        <DifficultyBreakdown rows={profile.difficulty[0].rows} />
      )}

      {platform.id === 'geeksforgeeks' && (
        <Card>
          <div className="grid gap-6 lg:grid-cols-2">
            {profile.difficulty.map((group) => (
              <Donut
                key={group.title}
                title={group.title}
                rows={group.rows.map((row) => ({
                  label: row.label,
                  count: row.solved,
                  color: row.color,
                }))}
              />
            ))}
          </div>
        </Card>
      )}

      {platform.id === 'hackerrank' && profile.topics.length > 0 && (
        <Card>
          <Donut
            title="Problems solved by skill"
            rows={profile.topics.map((topic, index) => ({
              ...topic,
              color: ['#10B981', '#0EA5E9', '#6366F1', '#F59E0B', '#EC4899', '#14B8A6'][index % 6],
            }))}
          />
        </Card>
      )}

      {profile.certificates.length > 0 && <CertificateCards certificates={profile.certificates} />}

      {profile.rating && profile.rating.history.length > 0 && (
        <RatingCard
          history={profile.rating.history}
          color={color}
          current={profile.rating.current}
        />
      )}

      {profile.ratingDistribution.length > 0 && (
        <RatingHistogram items={profile.ratingDistribution} />
      )}

      {hasCalendar && (
        <ActivityHeatmap
          calendar={profile.calendar}
          color={color}
          noun={platform.id === 'github' ? 'contributions' : 'submissions'}
        />
      )}

      {lists.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {lists
            .filter((list) => !(platform.id === 'hackerrank' && list.title === profile.topicsLabel))
            .map((list) => (
              <Card key={list.title}>
                <CardHeader title={list.title} />
                <BarList
                  items={list.items}
                  color={color}
                  unit={platform.id === 'github' ? '%' : undefined}
                />
              </Card>
            ))}
        </div>
      )}

      {profile.repos.length > 0 && <RepoCards repos={profile.repos} />}

      {profile.badges.length > 0 && (
        <Card>
          <CardHeader
            title={platform.id === 'hackerrank' ? 'Skill badges' : 'Badges & awards'}
            aside={`${profile.badges.length} earned`}
          />
          <BadgeWall badges={profile.badges} />
        </Card>
      )}

      {profile.recent.length > 0 && (
        <RecentTable items={profile.recent} kind={profile.recentKind} />
      )}

      {profile.notes.length > 0 && (
        <ul className="space-y-0.5 text-xs text-slate-500">
          {profile.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
