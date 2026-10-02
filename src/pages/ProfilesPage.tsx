import { useEffect, useMemo, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { ArrowLeft, Check, Link2 } from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
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
    <div className="rise-stagger space-y-5">
      <section className="from-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7">
        <div
          aria-hidden
          className="bg-brand-400/30 pointer-events-none absolute -top-24 right-1/4 size-72 rounded-full blur-3xl"
        />
        <Link
          to="/"
          className="text-brand-100 relative mb-4 inline-flex items-center gap-1 text-sm hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All students
        </Link>
        <div className="relative flex items-center gap-4">
          {name && <Avatar name={name} className="size-14 text-base ring-4 ring-white/20" />}
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {name ?? 'Look up a coding profile'}
            </h1>
            <p className="text-brand-100 mt-1 text-sm">
              Problems solved, badges, topics and activity across platforms.
            </p>
          </div>
        </div>
      </section>

      <HandleForm handles={handles} onSubmit={submit} />

      {loaded.length > 0 && <Summary profiles={loaded} />}

      <div className="rise-stagger grid gap-4 lg:grid-cols-2">
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
