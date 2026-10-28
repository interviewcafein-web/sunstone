import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  Check,
  Clock3,
  Globe2,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { ProfilePhoto } from '@/components/common/ProfileMenu';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/roles';
import { SESSION_KEY, saveProfile, useSession, type ProfileUpdate } from '@/lib/session';

const field =
  'focus-visible:outline-brand-500 w-full rounded-lg border border-slate-300 bg-surface px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 disabled:bg-slate-50 disabled:text-slate-500';
const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';

const when = (value: number | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not yet';

/** The signed-in person's own profile. */
export default function AccountPage() {
  const user = useSession().data;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProfileUpdate>({
    name: '',
    mobile: '',
    designation: '',
    bio: '',
  });
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (user) {
      setDraft({
        name: user.name ?? '',
        mobile: user.mobile ?? '',
        designation: user.designation ?? '',
        bio: user.bio ?? '',
      });
    }
  }, [user]);

  if (!user) return null;
  const change = (patch: Partial<ProfileUpdate>) => {
    setDraft({ ...draft, ...patch });
    setState('idle');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState('saving');
    setError(undefined);
    try {
      queryClient.setQueryData(SESSION_KEY, await saveProfile(draft));
      setState('saved');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save.');
      setState('idle');
    }
  };

  return (
    <div className="rise-stagger mx-auto max-w-4xl space-y-5">
      <section className="hero-glow from-brand-700 via-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-8">
        <div
          aria-hidden
          className="bg-brand-400/30 pointer-events-none absolute -top-24 right-10 size-72 rounded-full blur-3xl"
        />
        <div className="relative flex flex-wrap items-center gap-5">
          <ProfilePhoto user={user} className="size-20 text-xl ring-4 ring-white/25" />
          <div className="min-w-0">
            <p className="text-brand-200 text-xs font-semibold tracking-[0.2em] uppercase">
              My profile
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {user.name ?? user.user}
            </h1>
            <p className="text-brand-100 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {user.designation && <span>{user.designation}</span>}
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                <ShieldCheck className="size-3.5" aria-hidden />
                {ROLE_LABELS[user.role]}
              </span>
            </p>
          </div>
        </div>
        {!user.picture && user.hasProfile && (
          <p className="text-brand-100 relative mt-4 text-xs">
            Sign in with Google to show your Google profile photo here; it refreshes each time you
            sign in with Google.
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <form onSubmit={submit} className={`${panel} space-y-4 p-6 lg:col-span-2`}>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <UserRound className="text-brand-700 dark:text-brand-300 size-5" aria-hidden />
            Details
          </h2>
          {!user.hasProfile ? (
            <p className="text-sm text-slate-600">
              This is a temporary password account, so it has no profile. Sign in with Google or an
              emailed code to set one up.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="name">
                  <input
                    id="name"
                    value={draft.name}
                    onChange={(event) => change({ name: event.target.value })}
                    placeholder="Your name"
                    className={field}
                  />
                </Field>
                <Field label="Designation" htmlFor="designation">
                  <input
                    id="designation"
                    value={draft.designation}
                    onChange={(event) => change({ designation: event.target.value })}
                    placeholder="e.g. Campus Manager, PRIME"
                    className={field}
                  />
                </Field>
                <Field label="Email" htmlFor="email">
                  <input id="email" value={user.user} disabled className={field} />
                </Field>
                <Field label="Mobile" htmlFor="mobile">
                  <input
                    id="mobile"
                    type="tel"
                    value={draft.mobile}
                    onChange={(event) => change({ mobile: event.target.value })}
                    placeholder="+91 98765 43210"
                    className={field}
                  />
                </Field>
              </div>
              <Field label="About" htmlFor="bio">
                <textarea
                  id="bio"
                  rows={4}
                  value={draft.bio}
                  onChange={(event) => change({ bio: event.target.value })}
                  placeholder="What you look after: campuses, batches, programmes…"
                  className={`${field} resize-y`}
                />
              </Field>
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="flex items-center justify-end gap-3">
                {state === 'saved' && (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                    <Check className="size-4" aria-hidden />
                    Saved
                  </span>
                )}
                <button
                  type="submit"
                  disabled={state === 'saving'}
                  className="bg-brand-700 hover:bg-brand-800 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {state === 'saving' && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Save profile
                </button>
              </div>
            </>
          )}
        </form>

        <aside className={`${panel} space-y-4 p-6`}>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <BadgeCheck className="text-brand-700 dark:text-brand-300 size-5" aria-hidden />
            Access
          </h2>
          <div>
            <p className="text-sm font-semibold">{ROLE_LABELS[user.role]}</p>
            <p className="text-xs text-slate-500">{ROLE_DESCRIPTIONS[user.role]}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Campuses
            </p>
            {user.campuses ? (
              <ul className="space-y-1">
                {user.campuses.map((campus) => (
                  <li key={campus.id} className="flex items-center gap-2 text-sm">
                    <Building2 className="size-3.5 text-slate-400" aria-hidden />
                    {campus.name}
                  </li>
                ))}
                {!user.campuses.length && (
                  <li className="text-sm text-slate-500">None assigned yet</li>
                )}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm">
                <Globe2 className="size-3.5 text-slate-400" aria-hidden />
                Every campus
              </p>
            )}
          </div>
          <ul className="space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <Mail className="size-3.5 text-slate-400" aria-hidden />
              <span className="truncate">{user.user}</span>
            </li>
            {user.mobile && (
              <li className="flex items-center gap-2">
                <Phone className="size-3.5 text-slate-400" aria-hidden />
                {user.mobile}
              </li>
            )}
            <li className="flex items-center gap-2">
              <Clock3 className="size-3.5 text-slate-400" aria-hidden />
              Last sign-in {when(user.lastLoginAt)}
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      {children}
    </div>
  );
}
