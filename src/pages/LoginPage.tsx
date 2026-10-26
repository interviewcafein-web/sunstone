import { useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';

import { BrandLockup } from '@/components/common/BrandLockup';
import { VertexLogo } from '@/components/common/VertexLogo';
import { logIn } from '@/lib/session';

const route = getRouteApi('/login');

const field =
  'focus-visible:outline-brand-500 w-full rounded-lg border border-slate-300 bg-surface px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1';

export default function LoginPage() {
  const { next } = route.useSearch();
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
      // A full page load, so the app starts afresh with the session in place.
      window.location.assign(next ?? '/');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not log in.');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="shadow-card bg-surface overflow-hidden rounded-2xl border border-slate-200">
          <div className="from-brand-700 to-brand-900 bg-gradient-to-br px-6 py-6 text-white">
            <div className="flex items-center gap-4">
              <BrandLockup
                logoClassName="h-5 brightness-0 invert dark:filter-none"
                primeClassName="text-[9px]"
              />
              <span className="h-9 border-l border-white/25" aria-hidden />
              <VertexLogo onDark className="h-10" />
            </div>
            <h1 className="mt-5 flex items-center gap-2 text-xl font-bold">
              <LockKeyhole className="size-5" aria-hidden />
              Sign in to Vertex
            </h1>
            <p className="text-brand-100 mt-1 text-sm">
              Student progress, zones and campus reports for the Sunstone PRIME team.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4 p-6">
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

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="bg-brand-700 hover:bg-brand-800 focus-visible:outline-brand-500 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          No account? Ask the Sunstone PRIME team for one.
        </p>
      </div>
    </div>
  );
}
