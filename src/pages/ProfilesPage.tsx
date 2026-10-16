import { Fragment, useEffect, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { Check, ChevronRight, IdCard, LayoutGrid, Link2, Loader2, Pencil } from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { CodingOverview } from '@/components/coding/CodingOverview';
import { PlatformPanel } from '@/components/coding/PlatformPanel';
import { Card, formatNumber } from '@/components/coding/ui';
import { HandleForm } from '@/components/profile/HandleForm';
import { PlatformLogo } from '@/components/profile/PlatformLogo';
import { useCodingProfiles } from '@/hooks/useCodingProfiles';
import { useStudents } from '@/hooks/useStudents';
import {
  ProfileError,
  type CodingProfile,
  type Handles,
  type Platform,
  type PlatformId,
} from '@/lib/coding-profiles/types';
import type { Student } from '@/lib/students/types';
import { cn } from '@/lib/utils';

const route = getRouteApi('/profile');

type Tab = 'overview' | PlatformId;

export default function ProfilesPage() {
  const { name, ...handles } = route.useSearch();
  const navigate = route.useNavigate();

  // Campus and batch are not in the link; find this student in the sheet for the breadcrumb.
  const students = useStudents();
  const student = name
    ? students.data?.students.find(
        (candidate) =>
          candidate.name.toLowerCase() === name.toLowerCase() &&
          Object.entries(handles).some(
            ([platform, handle]) =>
              candidate.handles[platform as PlatformId]?.toLowerCase() === handle?.toLowerCase()
          )
      )
    : undefined;

  return (
    <ProfileView
      name={name}
      handles={handles}
      student={student}
      // Editing the handles turns this into an ad-hoc lookup, so the student's name is dropped.
      onSubmit={(next) => navigate({ search: next })}
    />
  );
}

interface ProfileViewProps {
  name?: string;
  handles: Handles;
  /** The sheet row, when known: adds campus and batch, the short link and the coding card. */
  student?: Student;
  onSubmit: (handles: Handles) => void;
}

/** The whole profile: header, usernames, platform tabs and their panels. */
export function ProfileView({ name, handles, student, onSubmit }: ProfileViewProps) {
  const [tab, setTab] = useState<Tab>('overview');

  const results = useCodingProfiles(handles);
  const loaded = results.flatMap(({ query }) => (query.data ? [query.data] : []));
  const hasHandles = results.length > 0;
  const active = results.find(({ platform }) => platform.id === tab);

  // A different person's handles: start again from the overview.
  const handleKey = JSON.stringify(handles);
  useEffect(() => setTab('overview'), [handleKey]);

  const shareUrl = student ? `${window.location.origin}/s/${student.slug}` : undefined;

  return (
    <div className="rise-stagger space-y-5">
      <section className="from-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7">
        <div
          aria-hidden
          className="bg-brand-400/30 pointer-events-none absolute -top-24 right-1/4 size-72 rounded-full blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <Breadcrumbs
            name={name}
            campus={student?.campus}
            batch={student?.batch}
            platform={active?.platform.name}
            onOverview={() => setTab('overview')}
          />
          {hasHandles && (
            <div className="flex flex-wrap gap-2">
              {student && (
                <Link
                  to="/s/$slug/card"
                  params={{ slug: student.slug }}
                  className="text-brand-800 hover:bg-brand-50 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  <IdCard className="size-3.5" aria-hidden />
                  Coding card
                </Link>
              )}
              <CopyLinkButton url={shareUrl} />
            </div>
          )}
        </div>
        <div className="relative flex items-center gap-4">
          {name && <Avatar name={name} className="size-14 text-base ring-4 ring-white/20" />}
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {name ?? 'Look up a coding profile'}
            </h1>
            <p className="text-brand-100 mt-1 text-sm">
              Problems solved, contests, badges, topics and activity across platforms.
            </p>
          </div>
        </div>
      </section>

      {hasHandles ? (
        <details className="group shadow-card rounded-2xl border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900">
            <Pencil className="size-4" aria-hidden />
            Edit usernames
          </summary>
          <div className="border-t border-slate-100 p-1">
            <HandleForm handles={handles} onSubmit={onSubmit} />
          </div>
        </details>
      ) : (
        <HandleForm handles={handles} onSubmit={onSubmit} />
      )}

      {hasHandles && (
        <>
          <nav
            aria-label="Platforms"
            className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 scrollbar-none"
          >
            <TabButton selected={tab === 'overview'} onClick={() => setTab('overview')}>
              <LayoutGrid className="text-brand-700 size-4" aria-hidden />
              Overview
            </TabButton>
            {results.map(({ platform, query }) => (
              <TabButton
                key={platform.id}
                selected={tab === platform.id}
                onClick={() => setTab(platform.id)}
              >
                <PlatformLogo platform={platform.id} />
                {platform.name}
                <TabCount query={query} />
              </TabButton>
            ))}
          </nav>

          {tab === 'overview' || !active ? (
            loaded.length > 0 ? (
              <CodingOverview profiles={loaded} />
            ) : results.some(({ query }) => query.isPending) ? (
              <LoadingCard label="Loading coding profiles…" />
            ) : (
              <Card>
                <p className="text-sm text-slate-600">None of these profiles could be loaded.</p>
              </Card>
            )
          ) : (
            <PlatformTab platform={active.platform} query={active.query} />
          )}
        </>
      )}
    </div>
  );
}

interface BreadcrumbsProps {
  name?: string;
  campus?: string;
  batch?: string;
  /** The open platform tab, if any; the student's name then leads back to the overview. */
  platform?: string;
  onOverview: () => void;
}

const crumbLink = 'text-brand-100 rounded hover:text-white hover:underline';

/** Students › Campus › Batch › Student › Platform; the last crumb is the current page. */
function Breadcrumbs({ name, campus, batch, platform, onOverview }: BreadcrumbsProps) {
  const known = (value?: string) => value && value !== 'Not specified';
  const crumbs: { key: string; node: React.ReactNode }[] = [
    {
      key: 'students',
      node: (
        <Link to="/" className={crumbLink}>
          Students
        </Link>
      ),
    },
  ];
  if (known(campus)) {
    crumbs.push({
      key: 'campus',
      node: (
        <Link to="/" search={{ campus }} className={crumbLink}>
          {campus}
        </Link>
      ),
    });
  }
  if (known(campus) && known(batch)) {
    crumbs.push({
      key: 'batch',
      node: (
        <Link to="/" search={{ campus, batch }} className={crumbLink}>
          Batch {batch}
        </Link>
      ),
    });
  }
  const person = name ?? 'Look up a profile';
  crumbs.push({
    key: 'person',
    node: platform ? (
      <button type="button" onClick={onOverview} className={crumbLink}>
        {person}
      </button>
    ) : (
      <span aria-current="page" className="font-medium text-white">
        {person}
      </span>
    ),
  });
  if (platform) {
    crumbs.push({
      key: 'platform',
      node: (
        <span aria-current="page" className="font-medium text-white">
          {platform}
        </span>
      ),
    });
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4 min-w-0">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.key}>
            {index > 0 && (
              <li aria-hidden className="text-brand-300">
                <ChevronRight className="size-3.5" />
              </li>
            )}
            <li className="min-w-0 truncate">{crumb.node}</li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
        selected
          ? 'border-brand-700 text-brand-800'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      )}
    >
      {children}
    </button>
  );
}

/** Solved count (or contributions for GitHub), a spinner while loading, "!" on failure. */
function TabCount({ query }: { query: UseQueryResult<CodingProfile, Error> }) {
  if (query.isPending)
    return <Loader2 className="size-3.5 animate-spin text-slate-400" aria-label="Loading" />;
  if (query.isError) {
    return (
      <span className="rounded-full bg-red-100 px-1.5 text-[11px] leading-4.5 font-bold text-red-700">
        !
      </span>
    );
  }
  const profile = query.data;
  const value = profile.solved ?? profile.kpis[0]?.value;
  if (value === null || value === undefined) return null;
  return (
    <span className="bg-brand-50 text-brand-800 rounded-full px-1.5 text-[11px] leading-4.5 tabular-nums">
      {typeof value === 'number' ? formatNumber(value) : value}
    </span>
  );
}

function PlatformTab({
  platform,
  query,
}: {
  platform: Platform;
  query: UseQueryResult<CodingProfile, Error>;
}) {
  if (query.isPending) return <LoadingCard label={`Loading ${platform.name} stats…`} />;
  if (query.isError) {
    const kind = query.error instanceof ProfileError ? query.error.kind : 'upstream';
    return (
      <Card className="border-red-200">
        <p className="flex items-center gap-2 font-semibold">
          <PlatformLogo platform={platform.id} className="size-5" />
          {platform.name}
        </p>
        <p className="mt-2 text-sm text-red-700">
          {kind === 'not_found'
            ? `No ${platform.name} account has this username.`
            : query.error.message || 'Something went wrong.'}
        </p>
        {kind !== 'not_found' && (
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-3 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
          >
            Try again
          </button>
        )}
      </Card>
    );
  }
  return <PlatformPanel platform={platform} profile={query.data} />;
}

export function LoadingCard({ label }: { label: string }) {
  return (
    <Card>
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {label}
      </p>
    </Card>
  );
}

/** Copies `url` (the short link, when there is one) or else the address bar. */
function CopyLinkButton({ url }: { url?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url ?? window.location.href);
      setCopied(true);
    } catch {
      // Clipboard access denied: the link is still in the address bar.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/20 hover:bg-white/20"
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
