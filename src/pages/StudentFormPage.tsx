import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PartyPopper,
  Save,
  XCircle,
} from 'lucide-react';

import { BrandLockup } from '@/components/common/BrandLockup';
import { VertexLogo } from '@/components/common/VertexLogo';
import { PlatformLogo } from '@/components/profile/PlatformLogo';
import { fetchCodingProfile } from '@/lib/coding-profiles/adapters';
import { readHandle } from '@/lib/coding-profiles/handles';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import { ProfileError, type PlatformId } from '@/lib/coding-profiles/types';
import { cn } from '@/lib/utils';

// The unlisted form students fill in themselves (/coding-usernames, shared as a link and
// linked from nowhere): their email finds them, then they type a username or paste a profile
// link for each platform. Each one is checked as they type, first its form and then whether
// the account exists, and nothing wrong can be saved. See api/student-form.ts.

const field =
  'focus-visible:outline-brand-500 w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1';
const primaryButton =
  'bg-brand-700 hover:bg-brand-800 focus-visible:outline-brand-500 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50';
const linkButton =
  'text-brand-700 dark:text-brand-300 inline-flex items-center gap-1 text-xs font-semibold hover:underline';

type Values = Record<PlatformId, string>;
type Saved = Record<PlatformId, string | null>;
const EMPTY = Object.fromEntries(PLATFORMS.map((platform) => [platform.id, ''])) as Values;

interface Found {
  firstName: string;
  campus: string;
  handles: Saved;
}

class FormError extends Error {
  constructor(
    message: string,
    readonly errors?: Partial<Record<PlatformId, string>>
  ) {
    super(message);
  }
}

async function post<T>(body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/student-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new FormError('No connection. Check your internet and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new FormError(data.error ?? 'Something went wrong. Please try again.', data.errors);
  return data as T;
}

/** Whether the account exists: 'unknown' when the platform could not be asked just now. */
async function accountExists(platform: PlatformId, username: string) {
  try {
    await fetchCodingProfile(platform, username);
    return 'found' as const;
  } catch (error) {
    return error instanceof ProfileError && error.kind === 'not_found'
      ? ('missing' as const)
      : ('unknown' as const);
  }
}

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** Keeps search engines away: the link is only for the students it is sent to. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = 'Your Coding Profiles · Sunstone PRIME';
    return () => {
      meta.remove();
      document.title = title;
    };
  }, []);
}

export default function StudentFormPage() {
  useNoIndex();
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  return (
    <div className="mx-auto w-full max-w-xl">
      <header className="mb-6 flex items-center justify-center gap-3">
        <BrandLockup logoClassName="h-5" primeClassName="text-[9px]" />
        <span className="flex items-center self-stretch border-l border-slate-300 pl-3">
          <VertexLogo className="h-8" />
        </span>
      </header>

      <div className="shadow-card bg-surface animate-rise overflow-hidden rounded-3xl border border-slate-200">
        <div
          className="from-brand-700 via-brand-500 h-1 bg-gradient-to-r to-amber-400"
          aria-hidden
        />
        <div className="p-5 sm:p-8">
          {saved && found ? (
            <Done
              firstName={found.firstName}
              saved={saved}
              onEdit={() => {
                setFound({ ...found, handles: saved });
                setSaved(null);
              }}
            />
          ) : found ? (
            <UsernamesStep
              email={email}
              found={found}
              onBack={() => setFound(null)}
              onSaved={setSaved}
            />
          ) : (
            <EmailStep email={email} setEmail={setEmail} onFound={setFound} />
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-500">
        Only your Sunstone PRIME team sees these, to follow your coding practice.
      </p>
    </div>
  );
}

function EmailStep({
  email,
  setEmail,
  onFound,
}: {
  email: string;
  setEmail: (email: string) => void;
  onFound: (found: Found) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onFound(await post<Found>({ action: 'lookup', email }));
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your Coding Profiles</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add your LeetCode, GeeksforGeeks, HackerRank, Codeforces, CodeChef and GitHub usernames,
          so your PRIME team can follow your practice. It takes a minute.
        </p>
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-600">
          Your Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="The email you gave Sunstone"
          required
          autoFocus
          className={cn(field, 'border-slate-300 py-3')}
        />
        <p className="mt-1 text-xs text-slate-500">Your personal or Sunstone email.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <ArrowRight className="size-4" aria-hidden />
        )}
        {busy ? 'Finding You…' : 'Continue'}
      </button>
    </form>
  );
}

type Status =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'checking'; username: string }
  | { kind: 'found'; username: string }
  | { kind: 'missing'; username: string }
  | { kind: 'unknown'; username: string };

function UsernamesStep({
  email,
  found,
  onBack,
  onSaved,
}: {
  email: string;
  found: Found;
  onBack: () => void;
  onSaved: (saved: Saved) => void;
}) {
  const [values, setValues] = useState<Values>(() => ({
    ...EMPTY,
    ...Object.fromEntries(Object.entries(found.handles).map(([id, value]) => [id, value ?? ''])),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [serverErrors, setServerErrors] = useState<Partial<Record<PlatformId, string>>>({});
  const settled = useDebounced(values, 600);

  const read = (values: Values) =>
    PLATFORMS.map((platform) => readHandle(platform.id, values[platform.id], platform.name));
  const now = useMemo(() => read(values), [values]);
  const later = useMemo(() => read(settled), [settled]);

  const checks = useQueries({
    queries: PLATFORMS.map((platform, index) => {
      const check = later[index];
      const username = check.ok ? check.username : null;
      return {
        queryKey: ['handle-check', platform.id, username?.toLowerCase()],
        queryFn: () => accountExists(platform.id, username!),
        enabled: Boolean(username),
        retry: false,
        staleTime: Infinity,
      };
    }),
  });

  const statuses: Status[] = PLATFORMS.map((platform, index) => {
    const check = now[index];
    if (serverErrors[platform.id]) return { kind: 'invalid', message: serverErrors[platform.id]! };
    if (!check.ok) return { kind: 'invalid', message: check.error };
    if (!check.username) return { kind: 'empty' };
    const settledCheck = later[index];
    const result = checks[index].data;
    if (!settledCheck.ok || settledCheck.username !== check.username || !result) {
      return { kind: 'checking', username: check.username };
    }
    return { kind: result, username: check.username };
  });

  const filled = statuses.filter((status) => status.kind !== 'empty').length;
  const blocked = statuses.some((status) => status.kind === 'invalid' || status.kind === 'missing');
  const checking = statuses.some((status) => status.kind === 'checking');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || checking || !filled) return;
    setBusy(true);
    setError('');
    try {
      const result = await post<{ handles: Saved }>({ action: 'save', email, handles: values });
      onSaved(result.handles);
    } catch (problem) {
      setError((problem as Error).message);
      if (problem instanceof FormError && problem.errors) setServerErrors(problem.errors);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <button type="button" onClick={onBack} className={linkButton}>
          <ArrowLeft className="size-3.5" aria-hidden />
          Not You? Change Email
        </button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Hi {found.firstName}!
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {found.campus}. Type your username or paste your profile link for each platform you use.
          Leave a platform empty if you do not have an account there.
        </p>
      </div>

      <div className="space-y-4">
        {PLATFORMS.map((platform, index) => (
          <PlatformField
            key={platform.id}
            id={platform.id}
            name={platform.name}
            placeholder={platform.placeholder}
            profileUrl={platform.profileUrl}
            value={values[platform.id]}
            status={statuses[index]}
            onChange={(value) => {
              setValues((current) => ({ ...current, [platform.id]: value }));
              setServerErrors(({ [platform.id]: _, ...rest }) => rest);
            }}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || blocked || checking || !filled}
        className={primaryButton}
      >
        {busy || checking ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        {busy ? 'Saving…' : checking ? 'Checking Usernames…' : 'Save My Usernames'}
      </button>
      {!busy && !checking && (blocked || !filled) && (
        <p className="-mt-2 text-center text-xs text-slate-500">
          {blocked
            ? 'Fix the usernames marked in red to save.'
            : 'Add at least one username to save.'}
        </p>
      )}
    </form>
  );
}

function PlatformField({
  id,
  name,
  placeholder,
  profileUrl,
  value,
  status,
  onChange,
}: {
  id: PlatformId;
  name: string;
  placeholder: string;
  profileUrl: (handle: string) => string;
  value: string;
  status: Status;
  onChange: (value: string) => void;
}) {
  const bad = status.kind === 'invalid' || status.kind === 'missing';
  const note = `${id}-note`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800"
      >
        <PlatformLogo platform={id} />
        {name}
      </label>
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Username (e.g. ${placeholder}) or profile link`}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={bad}
          aria-describedby={note}
          className={cn(
            field,
            'pr-9',
            bad
              ? 'border-red-400 bg-red-50/40'
              : status.kind === 'found'
                ? 'border-emerald-400'
                : 'border-slate-300'
          )}
        />
        <span className="absolute inset-y-0 right-3 flex items-center" aria-hidden>
          {status.kind === 'checking' && <Loader2 className="size-4 animate-spin text-slate-400" />}
          {status.kind === 'found' && <CheckCircle2 className="size-4 text-emerald-600" />}
          {bad && <XCircle className="size-4 text-red-500" />}
          {status.kind === 'unknown' && <AlertTriangle className="size-4 text-amber-500" />}
        </span>
      </div>
      <p id={note} className="mt-1 min-h-4 text-xs" aria-live="polite">
        {status.kind === 'invalid' && <span className="text-red-600">{status.message}</span>}
        {status.kind === 'missing' && (
          <span className="text-red-600">
            No {name} account is called “{status.username}”. Check the spelling, or paste your
            profile link.
          </span>
        )}
        {status.kind === 'checking' && <span className="text-slate-500">Checking {name}…</span>}
        {status.kind === 'found' && (
          <span className="text-emerald-700 dark:text-emerald-400">
            Found: {status.username}{' '}
            <a
              href={profileUrl(status.username)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 font-semibold hover:underline"
            >
              Open
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </span>
        )}
        {status.kind === 'unknown' && (
          <span className="text-amber-700">
            {name} could not be checked just now. It will be saved as “{status.username}”.
          </span>
        )}
      </p>
    </div>
  );
}

function Done({
  firstName,
  saved,
  onEdit,
}: {
  firstName: string;
  saved: Saved;
  onEdit: () => void;
}) {
  return (
    <div className="text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <PartyPopper className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
        Thank You, {firstName}!
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Your usernames are saved. Your PRIME team will see your practice from now on.
      </p>
      <ul className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 text-left">
        {PLATFORMS.filter((platform) => saved[platform.id]).map((platform) => (
          <li key={platform.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <PlatformLogo platform={platform.id} />
            <span className="font-medium text-slate-700">{platform.name}</span>
            <span className="ml-auto truncate font-mono text-slate-900">{saved[platform.id]}</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onEdit} className={cn(linkButton, 'mt-5')}>
        Change Something
      </button>
    </div>
  );
}
