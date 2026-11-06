import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  BriefcaseBusiness,
  Crown,
  Loader2,
  LockKeyhole,
  Mail,
  MessagesSquare,
  ShieldCheck,
} from 'lucide-react';

import { BrandLockup } from '@/components/common/BrandLockup';
import { forgetCache } from '@/lib/queryCache';
import { sendSignInCode, verifySignInCode } from '@/lib/session';
import { cn } from '@/lib/utils';

import { ConvergeLogo } from '../components/ConvergeLogo';
import { useRouteSearch } from '../nav';
import type { LoginSearch } from '../routes';

const field =
  'focus-visible:outline-brand-500 w-full rounded-xl border border-slate-300 bg-surface px-3.5 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1';
const primaryButton =
  'bg-brand-700 hover:bg-brand-800 focus-visible:outline-brand-500 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60';
const linkButton =
  'text-brand-700 dark:text-brand-300 inline-flex items-center gap-1 text-xs font-semibold hover:underline';

const RESEND_SECONDS = 60;

/** A full page load, so the app starts afresh with the session in place. */
const enter = (next: string | undefined) => window.location.assign(next ?? '/');

/** Converge sign-in: a 6-digit code sent to the staff member's work email. */
export default function LoginPage() {
  const { next } = useRouteSearch<LoginSearch>();
  const queryClient = useQueryClient();
  // Whoever signs in next starts clean: nothing kept from the last person on this browser.
  useEffect(() => {
    void forgetCache(queryClient);
  }, [queryClient]);

  return (
    <div className="flex min-h-[78vh] items-center justify-center py-4">
      <div className="shadow-card bg-surface animate-rise grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 md:grid-cols-[1.1fr_1fr]">
        <BrandPanel />

        <div className="flex flex-col justify-center p-6 sm:p-10">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <LockKeyhole className="text-brand-600 size-5" aria-hidden />
            Welcome Back
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in with your work email. We will send you a 6-digit code.
          </p>

          <div className="mt-6">
            <EmailCodeForm next={next} />
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
  {
    icon: BriefcaseBusiness,
    title: 'PRIME Domain',
    text: 'IT, HR, finance, revenue and operations tests',
  },
  {
    icon: MessagesSquare,
    title: 'Communication & Aptitude',
    text: 'ELQ, mock interviews and group discussions',
  },
  { icon: Award, title: 'AMCAT and Exams', text: 'Every sitting, midterm and end-term' },
  { icon: Crown, title: 'Super 100', text: 'The top cohort, side by side' },
];

/** The left half: the Converge wordmark, a line about it and what is inside. */
function BrandPanel() {
  return (
    <div className="from-brand-700 via-brand-800 to-brand-900 hero-glow relative flex flex-col justify-between gap-8 bg-gradient-to-br p-6 text-white sm:p-10">
      <div aria-hidden className="grid-lines absolute inset-0 -z-10" />
      <img
        src="/converge-mark-white.png"
        alt=""
        aria-hidden
        className="animate-float pointer-events-none absolute -right-10 -bottom-12 -z-10 w-64 opacity-[0.07]"
      />

      <div className="space-y-4">
        <ConvergeLogo onDark className="h-12 sm:h-14" />
        <BrandLockup
          logoClassName="h-4 brightness-0 invert dark:filter-none"
          primeClassName="text-[8px]"
        />
      </div>

      <div>
        <h2 className="text-3xl leading-tight font-bold sm:text-4xl">
          Every future manager,
          <span className="block bg-gradient-to-r from-[#fde68a] via-[#e9c27a] to-[#c8913a] bg-clip-text text-transparent">
            in one view.
          </span>
        </h2>
        <ul className="rise-stagger mt-6 hidden space-y-3 md:block">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Icon className="size-4.5 text-[#e9c27a]" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="text-brand-100 block text-xs">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-brand-200 hidden text-xs md:block">
        Sunstone PRIME · BBA and MBA · Converge 2026
      </p>
    </div>
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
            Work Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="name@sunstone.in"
            required
            autoFocus
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
          {busy ? 'Sending…' : 'Email Me a Sign-In Code'}
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
          6-Digit Code
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
        {busy ? 'Signing In…' : 'Sign In'}
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
          Different Email
        </button>
        <button
          type="button"
          className={cn(linkButton, 'disabled:text-slate-400 disabled:no-underline')}
          disabled={wait > 0 || busy}
          onClick={send}
        >
          {wait > 0 ? `Resend in ${wait}s` : 'Resend Code'}
        </button>
      </div>
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
