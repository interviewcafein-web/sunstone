import { useEffect, useMemo, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { ArrowLeft, Check, Link2 } from 'lucide-react';

import { HandleForm } from '@/components/profile/HandleForm';
import { Heatmap, summarizeCalendar } from '@/components/profile/Heatmap';
import { PlatformCard } from '@/components/profile/PlatformCard';
import { SectionLabel, StatTiles } from '@/components/profile/StatTiles';
import { useCodingProfiles } from '@/hooks/useCodingProfiles';
import type { CodingProfile, Handles } from '@/lib/coding-profiles/types';

const route = getRouteApi('/profile');

export default function ProfilesPage() {
  const { name, ...handles } = route.useSearch();
  const navigate = route.useNavigate();

  const results = useCodingProfiles(handles);
  const loaded = results.flatMap(({ query }) => (query.data ? [query.data] : []));

  // Editing the handles turns this into an ad-hoc lookup, so the student's name is dropped.
  const submit = (next: Handles) => navigate({ search: next });

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/"
          className="hover:text-brand-700 mb-2 inline-flex items-center gap-1 text-sm text-slate-500"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All students
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{name ?? 'Look up a coding profile'}</h1>
        <p className="text-sm text-slate-600">
          Problems solved, badges, topics and activity across platforms.
        </p>
      </div>

      <HandleForm handles={handles} onSubmit={submit} />

      {loaded.length > 0 && <Summary profiles={loaded} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {results.map(({ platform, query }) => (
          <PlatformCard key={platform.id} platform={platform} query={query} />
        ))}
      </div>
    </div>
  );
}

function Summary({ profiles }: { profiles: CodingProfile[] }) {
  const combined = useMemo(() => {
    const calendar: Record<string, number> = {};
    for (const profile of profiles) {
      for (const [day, count] of Object.entries(profile.calendar)) {
        calendar[day] = (calendar[day] || 0) + count;
      }
    }
    return calendar;
  }, [profiles]);

  const stats = [
    {
      label: 'Problems solved, all platforms',
      value: profiles.reduce((sum, profile) => sum + (profile.solved?.total ?? 0), 0),
    },
    { label: 'Platforms', value: profiles.length },
    { label: 'Badges', value: profiles.reduce((sum, profile) => sum + profile.badges.length, 0) },
    { label: 'Active days (12 mo)', value: summarizeCalendar(combined).activeDays },
  ];

  return (
    <section className="shadow-card rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StatTiles stats={stats} />
        <CopyLinkButton />
      </div>
      <SectionLabel>Combined activity, last 12 months</SectionLabel>
      <Heatmap calendar={combined} />
    </section>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Clipboard access denied: the link is still in the address bar.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Link2 className="size-3.5" aria-hidden />
      )}
      {copied ? 'Link copied' : 'Copy share link'}
    </button>
  );
}
