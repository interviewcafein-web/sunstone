import { useState } from 'react';
import { BadgeCheck, ExternalLink, GitFork, Star } from 'lucide-react';

import { Card, CardHeader, formatDate, formatNumber } from '@/components/coding/ui';
import type { Award, Certificate, RecentItem, Repo } from '@/lib/coding-profiles/types';
import { cn } from '@/lib/utils';

// Upstream data is untrusted: only ever render https links and images.
export const safeUrl = (value?: string) => (value?.startsWith('https://') ? value : undefined);

// ------------------------------------------------------- recent submissions

function statusTone(status: string) {
  if (/accepted/i.test(status)) return 'bg-emerald-100 text-emerald-800';
  if (/time limit|memory|partial|idle/i.test(status)) return 'bg-amber-100 text-amber-900';
  return 'bg-red-100 text-red-800';
}

const DIFFICULTY_TEXT: Record<string, string> = {
  Easy: 'text-emerald-600',
  Medium: 'text-amber-600',
  Hard: 'text-red-600',
  Basic: 'text-sky-600',
  School: 'text-violet-600',
};

export function RecentTable({ items, kind }: { items: RecentItem[]; kind: 'all' | 'solved' }) {
  const rows = items.slice(0, 15);
  const hasStatus = rows.some((row) => row.status);
  const hasDifficulty = rows.some((row) => row.difficulty);
  const hasLanguage = rows.some((row) => row.language);

  return (
    <Card>
      <CardHeader
        title={kind === 'solved' ? 'Recently solved' : 'Recent submissions'}
        aside={`last ${rows.length}`}
      />
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] tracking-wide text-slate-500 uppercase">
              <th className="px-5 py-2 font-medium">Problem</th>
              {(hasStatus || hasDifficulty) && (
                <th className="px-3 py-2 font-medium">{hasStatus ? 'Result' : 'Difficulty'}</th>
              )}
              {hasLanguage && <th className="px-3 py-2 font-medium">Language</th>}
              <th className="px-5 py-2 text-right font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const url = safeUrl(row.url);
              return (
                <tr
                  key={`${row.title}-${row.time}-${index}`}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="max-w-72 truncate px-5 py-2">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-700 hover:underline"
                      >
                        {row.title}
                      </a>
                    ) : (
                      row.title
                    )}
                  </td>
                  {(hasStatus || hasDifficulty) && (
                    <td className="px-3 py-2">
                      {row.status ? (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                            statusTone(row.status)
                          )}
                        >
                          {row.status}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'text-xs font-medium',
                            DIFFICULTY_TEXT[row.difficulty ?? '']
                          )}
                        >
                          {row.difficulty}
                        </span>
                      )}
                    </td>
                  )}
                  {hasLanguage && (
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.language}</td>
                  )}
                  <td className="px-5 py-2 text-right text-xs whitespace-nowrap text-slate-500">
                    {row.time ? formatDate(row.time, true) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------- badges & awards

/** Image or chip badges (LeetCode, CodeChef). */
export function BadgeWall({ badges, compact = false }: { badges: Award[]; compact?: boolean }) {
  return (
    <ul
      className={cn(
        'grid gap-3',
        compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
      )}
    >
      {badges.map((badge, index) => {
        const icon = safeUrl(badge.icon);
        return (
          <li
            key={`${badge.name}-${index}`}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
          >
            {icon ? (
              <img src={icon} alt="" loading="lazy" className="size-12 shrink-0 object-contain" />
            ) : badge.stars !== undefined ? (
              <HexBadge stars={badge.stars} />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800" title={badge.name}>
                {badge.name}
              </p>
              {badge.detail && (
                <p className="line-clamp-2 text-[11px] text-slate-500">{badge.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** HackerRank-style hexagon: gold at 5★+, silver at 3★+, bronze at 1★+. */
export function HexBadge({ stars }: { stars: number }) {
  const tone =
    stars >= 5
      ? 'from-amber-300 to-amber-500 text-amber-950'
      : stars >= 3
        ? 'from-slate-200 to-slate-400 text-slate-800'
        : stars >= 1
          ? 'from-orange-300 to-orange-600 text-orange-950'
          : 'from-slate-100 to-slate-200 text-slate-400';

  return (
    <span
      className={cn(
        'flex size-12 shrink-0 items-center justify-center bg-gradient-to-br text-xs font-extrabold',
        tone
      )}
      style={{ clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)' }}
    >
      {stars}★
    </span>
  );
}

// -------------------------------------------------------------- certificates

export function CertificateCards({ certificates }: { certificates: Certificate[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? certificates : certificates.slice(0, 4);

  return (
    <Card>
      <CardHeader title="Certificates" aside={`${certificates.length} verified`} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((certificate) => {
          const url = safeUrl(certificate.url);
          return (
            <li key={certificate.name + certificate.completedAt}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full items-center gap-3 rounded-xl bg-gradient-to-br from-emerald-50 to-white p-3 ring-1 ring-emerald-200 transition hover:ring-emerald-400"
              >
                <BadgeCheck className="size-8 shrink-0 text-emerald-600" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {certificate.name}
                  </p>
                  <p className="text-xs text-emerald-700">
                    Verified
                    {certificate.completedAt ? ` · ${formatDate(certificate.completedAt)}` : ''}
                  </p>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
      {certificates.length > 4 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-brand-700 mt-3 text-xs font-semibold hover:underline"
        >
          {showAll ? 'Show fewer' : `Show all ${certificates.length}`}
        </button>
      )}
    </Card>
  );
}

// --------------------------------------------------------------------- repos

export function RepoCards({ repos }: { repos: Repo[] }) {
  return (
    <Card>
      <CardHeader title="Top repositories" aside="by stars" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {repos.map((repo) => (
          <li key={repo.name}>
            <a
              href={safeUrl(repo.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:border-brand-300 flex h-full flex-col rounded-xl border border-slate-200 p-3 transition"
            >
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
                <GitFork className="size-3.5 text-slate-400" aria-hidden />
                {repo.name}
              </p>
              <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-500">
                {repo.description ?? 'No description'}
              </p>
              <p className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                {repo.language && <span>{repo.language}</span>}
                <span className="inline-flex items-center gap-0.5">
                  <Star className="size-3 text-amber-500" aria-hidden />
                  {formatNumber(repo.stars)}
                </span>
                <ExternalLink className="ml-auto size-3 text-slate-400" aria-hidden />
              </p>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
