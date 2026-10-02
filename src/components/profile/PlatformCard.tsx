import type { UseQueryResult } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';

import { BarList } from '@/components/profile/BarList';
import { Heatmap } from '@/components/profile/Heatmap';
import { PlatformLogo } from '@/components/profile/PlatformLogo';
import { SectionLabel, StatTiles } from '@/components/profile/StatTiles';
import { ProfileError, type CodingProfile, type Platform } from '@/lib/coding-profiles/types';

const ERROR_LABELS: Record<string, string> = {
  not_found: 'Not found',
  relay: 'Relay missing',
};

// Upstream data is untrusted: only ever render https image and link URLs.
const safeUrl = (value?: string) => (value?.startsWith('https://') ? value : undefined);

interface PlatformCardProps {
  platform: Platform;
  query: UseQueryResult<CodingProfile, Error>;
}

export function PlatformCard({ platform, query }: PlatformCardProps) {
  return (
    <article className="shadow-card min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      {query.isPending ? (
        <div className="flex items-center gap-2">
          <PlatformLogo platform={platform.id} className="size-5" />
          <h2 className="font-semibold">{platform.name}</h2>
          <Loader2 className="size-4 animate-spin text-slate-400" aria-hidden />
          <span className="text-sm text-slate-500">Fetching…</span>
        </div>
      ) : query.isError ? (
        <ErrorState platform={platform} error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <ProfileBody platform={platform} profile={query.data} />
      )}
    </article>
  );
}

function ErrorState({
  platform,
  error,
  onRetry,
}: {
  platform: Platform;
  error: Error;
  onRetry: () => void;
}) {
  const kind = error instanceof ProfileError ? error.kind : 'upstream';

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <PlatformLogo platform={platform.id} className="size-5" />
          {platform.name}
        </h2>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
          {ERROR_LABELS[kind] ?? 'Failed'}
        </span>
      </div>
      <p className="mt-2 text-sm text-red-700">{error.message || 'Something went wrong.'}</p>
      {kind !== 'not_found' && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function ProfileBody({ platform, profile }: { platform: Platform; profile: CodingProfile }) {
  const avatar = safeUrl(profile.avatar);
  const link = safeUrl(profile.profileUrl);
  const stats = profile.solved
    ? [{ label: 'Problems solved', value: profile.solved.total }, ...profile.headline]
    : profile.headline;
  const hasCalendar = Object.keys(profile.calendar).length > 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        {avatar && (
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="size-9 rounded-full bg-slate-200 object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-semibold">
            <PlatformLogo platform={platform.id} className="size-5" />
            <span className="truncate">
              {platform.name} · {profile.name}
            </span>
          </h2>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
            >
              @{profile.username}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </div>

      <StatTiles stats={stats} />

      {profile.solved && profile.solved.breakdown.length > 0 && (
        <>
          <SectionLabel>Solved by difficulty</SectionLabel>
          <BarList items={profile.solved.breakdown} />
        </>
      )}

      {profile.topics.length > 0 && (
        <>
          <SectionLabel>{profile.topicsLabel ?? 'Solved by topic'}</SectionLabel>
          <BarList items={profile.topics} />
        </>
      )}

      {profile.badges.length > 0 && (
        <>
          <SectionLabel>Badges</SectionLabel>
          <ul className="flex flex-wrap gap-1.5">
            {profile.badges.map((badge, index) => {
              const icon = safeUrl(badge.icon);
              return (
                <li
                  key={`${badge.name}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-0.5 text-xs"
                >
                  {icon && <img src={icon} alt="" loading="lazy" className="size-4" />}
                  {badge.name}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {hasCalendar && (
        <>
          <SectionLabel>Activity, last 12 months</SectionLabel>
          <Heatmap calendar={profile.calendar} />
        </>
      )}

      {profile.notes.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs text-slate-500">
          {profile.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
