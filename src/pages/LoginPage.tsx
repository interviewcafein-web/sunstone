import { useEffect, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import {
  ArrowLeft,
  Building2,
  Code2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

import { BrandLockup } from '@/components/common/BrandLockup';
import { VertexLogo } from '@/components/common/VertexLogo';
import { logIn, sendSignInCode, useSignInMethods, verifySignInCode } from '@/lib/session';
import { cn } from '@/lib/utils';

const route = getRouteApi('/login');

const field =
  'focus-visible:outline-brand-500 w-full rounded-xl border border-slate-300 bg-surface px-3.5 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1';
const primaryButton =
  'bg-brand-700 hover:bg-brand-800 focus-visible:outline-brand-500 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60';
const linkButton =
  'text-brand-700 dark:text-brand-300 inline-flex items-center gap-1 text-xs font-semibold hover:underline';

/** Why Google sign-in came back to this page (see api/auth/_google.ts). */
const GOOGLE_ERRORS: Record<string, string> = {
  not_staff:
    'That Google account does not have access. Sign in with your work email, or ask the Sunstone PRIME team to add you.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_expired: 'The Google sign-in took too long. Please try again.',
  google_failed: 'Google sign-in did not work. Please try again.',
  google_not_configured: 'Google sign-in is not set up yet.',
};

const RESEND_SECONDS = 60;

/** A full page load, so the app starts afresh with the session in place. */
const enter = (next: string | undefined) => window.location.assign(next ?? '/');

export default function LoginPage() {
  const { next, error: googleError } = route.useSearch();
  const methods = useSignInMethods().data;
  const [mode, setMode] = useState<'choose' | 'password'>('choose');

  // With only password login set up there is nothing to choose between.
  const passwordOnly = methods && !methods.google && !methods.email;
  const showPassword = mode === 'password' || passwordOnly;

  return (
    <div className="flex min-h-[78vh] items-center justify-center py-4">
      <div className="shadow-card bg-surface animate-rise grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 md:grid-cols-[1.1fr_1fr]">
        <BrandPanel />

        <div className="flex flex-col justify-center p-6 sm:p-10">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <LockKeyhole className="text-brand-600 size-5" aria-hidden />
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your work account to continue.</p>

          <div className="mt-6 space-y-4">
            {googleError && mode === 'choose' && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {GOOGLE_ERRORS[googleError] ?? 'Sign-in did not work. Please try again.'}
              </p>
            )}

            {!methods ? (
              <div className="space-y-3" aria-label="Loading" role="status">
                <div className="skeleton h-11 rounded-xl" />
                <div className="skeleton h-3 w-1/3 rounded" />
                <div className="skeleton h-11 rounded-xl" />
              </div>
            ) : showPassword ? (
              <>
                <PasswordForm next={next} />
                {!passwordOnly && (
                  <button type="button" className={linkButton} onClick={() => setMode('choose')}>
                    <ArrowLeft className="size-3.5" aria-hidden />
                    Other ways to sign in
                  </button>
                )}
              </>
            ) : (
              <>
                {methods.google && <GoogleButton next={next} />}
                {methods.google && methods.email && (
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    or with a one-time code
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                )}
                {methods.email && <EmailCodeForm next={next} />}
                {methods.password && (
                  <div className="border-t border-slate-100 pt-3 text-center">
                    <button
                      type="button"
                      className={linkButton}
                      onClick={() => setMode('password')}
                    >
                      <KeyRound className="size-3.5" aria-hidden />
                      Sign in with username and password
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <p className="mt-8 flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden />
            For the Sunstone PRIME team. No access? Ask HQ to add your email.
          </p>
        </div>
      </div>
    </div>
  );
}

const HIGHLIGHTS = [
  { icon: Code2, title: 'Coding practice', text: 'LeetCode, GFG and GitHub for every student' },
  { icon: Building2, title: 'Campus journeys', text: 'Tests, exams, attendance and AMCAT' },
  { icon: TrendingUp, title: 'Trends that matter', text: 'Spot who is slipping, week by week' },
];

/** The left half: brand, a line about Vertex and what is inside, over a slowly moving backdrop. */
function BrandPanel() {
  return (
    <div className="from-brand-700 via-brand-800 to-brand-900 hero-glow relative flex flex-col justify-between gap-8 bg-gradient-to-br p-6 text-white sm:p-10">
      <div aria-hidden className="grid-lines absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="animate-float absolute -bottom-16 -left-12 -z-10 size-56 rounded-full bg-sky-400/20 blur-2xl"
      />
      <div
        aria-hidden
        className="animate-float absolute top-10 right-8 -z-10 hidden size-24 md:block rounded-3xl border border-white/15 bg-white/5"
        style={{ animationDelay: '-6s' }}
      />

      <div className="flex items-center gap-4">
        <BrandLockup
          logoClassName="h-5 brightness-0 invert dark:filter-none"
          primeClassName="text-[9px]"
        />
        <span className="h-9 border-l border-white/25" aria-hidden />
        <VertexLogo onDark className="h-10" />
      </div>

      <div>
        <h2 className="text-3xl leading-tight font-bold sm:text-4xl">
          Every student&rsquo;s climb,
          <span className="block bg-gradient-to-r from-[#fde68a] via-[#fcd34d] to-[#bae6fd] bg-clip-text text-transparent">
            in one view.
          </span>
        </h2>
        <ul className="rise-stagger mt-6 hidden space-y-3 md:block">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="text-brand-100 block text-xs">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-brand-200 hidden text-xs md:block">Sunstone PRIME · Vertex</p>
    </div>
  );
}

function GoogleButton({ next }: { next?: string }) {
  const href = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return (
    <a
      href={href}
      className="bg-surface focus-visible:outline-brand-500 hover-lift flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <GoogleLogo className="size-4.5" />
      Continue with Google
    </a>
  );
}

function EmailCodeForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const send = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setNotice(await sendSignInCode(email));
      setStep('code');
      setCode('');
      setWait(RESEND_SECONDS);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not send a code.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    setBusy(true);
    setError(undefined);
    try {
      await verifySignInCode(email, value);
      enter(next);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign in.');
      setBusy(false);
    }
  };

  if (step === 'email') {
    return (
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div>
          <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-600">
            Work email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="name@sunstone.in"
            required
            className={field}
          />
        </div>
        {error && <ErrorNote message={error} />}
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Mail className="size-4" aria-hidden />
          )}
          {busy ? 'Sending…' : 'Email me a sign-in code'}
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        verify();
      }}
    >
      <p className="bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100 rounded-lg px-3 py-2 text-sm">
        {notice} Sent to <span className="font-semibold">{email}</span>.
      </p>
      <div>
        <label htmlFor="code" className="mb-1 block text-xs font-medium text-slate-600">
          6-digit code
        </label>
        <input
          id="code"
          value={code}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(value);
            // Pasting or typing the last digit signs in straight away.
            if (value.length === 6 && !busy) verify(value);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          pattern="\d{6}"
          className={cn(field, 'text-center font-mono text-xl tracking-[0.5em]')}
        />
      </div>
      {error && <ErrorNote message={error} />}
      <button type="submit" disabled={busy || code.length !== 6} className={primaryButton}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className={linkButton}
          onClick={() => {
            setStep('email');
            setError(undefined);
          }}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Different email
        </button>
        <button
          type="button"
          className={cn(linkButton, 'disabled:text-slate-400 disabled:no-underline')}
          disabled={wait > 0 || busy}
          onClick={send}
        >
          {wait > 0 ? `Resend in ${wait}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm({ next }: { next?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await logIn(username, password);
      enter(next);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not log in.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="username" className="mb-1 block text-xs font-medium text-slate-600">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          className={field}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-medium text-slate-600">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className={`${field} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
      {error && <ErrorNote message={error} />}
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

/** Google's "G" mark, in its four brand colours. */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"
      />
    </svg>
  );
}
