import { Link, Outlet, createRootRoute } from '@tanstack/react-router';
import { LogIn, LogOut, UserRound } from 'lucide-react';

import { BrandLockup } from '@/components/common/BrandLockup';
import { VertexLogo } from '@/components/common/VertexLogo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { ROLE_LABELS } from '@/lib/roles';
import { useLogOut, useSession } from '@/lib/session';

export const Route = createRootRoute({
  component: RootComponent,
});

const navLink =
  'hover:bg-brand-50 dark:hover:bg-brand-900/40 hover:text-brand-700 dark:hover:text-brand-300 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors';
const navLinkActive = {
  className: 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
};

function RootComponent() {
  const session = useSession();
  const logOut = useLogOut();
  const user = session.data;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <BrandLockup />
            <span className="flex items-center self-stretch border-l border-slate-300 pl-3">
              <VertexLogo className="h-8" />
            </span>
          </Link>
          <nav className="ml-auto flex flex-wrap items-center justify-end gap-1">
            {user ? (
              <>
                <Link
                  to="/"
                  className={navLink}
                  activeProps={navLinkActive}
                  activeOptions={{ exact: true, includeSearch: false }}
                >
                  Students
                </Link>
                <Link
                  to="/profile"
                  className={navLink}
                  activeProps={navLinkActive}
                  activeOptions={{ includeSearch: false }}
                >
                  Look up a profile
                </Link>
                <Link
                  to="/resources"
                  className={navLink}
                  activeProps={navLinkActive}
                  activeOptions={{ includeSearch: false }}
                >
                  Resources
                </Link>
                {user.managesTeam && (
                  <Link to="/team" className={navLink} activeProps={navLinkActive}>
                    Team
                  </Link>
                )}
              </>
            ) : (
              !session.isPending && (
                <Link to="/login" className={`${navLink} inline-flex items-center gap-1.5`}>
                  <LogIn className="size-4" aria-hidden />
                  Staff login
                </Link>
              )
            )}
            <ThemeToggle />
            {user && (
              <span className="ml-1 flex items-center gap-1 border-l border-slate-200 pl-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700"
                  title={`Signed in as ${user.user} · ${ROLE_LABELS[user.role]}${
                    user.campuses
                      ? ` · ${user.campuses.map((campus) => campus.name).join(', ')}`
                      : ''
                  }`}
                >
                  <UserRound className="size-4 text-slate-500" aria-hidden />
                  {/* Phones show just the icon (name on hover) so the header fits. */}
                  <span className="hidden max-w-[14rem] truncate sm:inline">
                    {user.name ?? user.user}
                  </span>
                  <span className="sr-only sm:hidden">{user.name ?? user.user}</span>
                  <span className="bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200 hidden rounded-full px-2 py-0.5 text-[10px] font-semibold md:inline">
                    {ROLE_LABELS[user.role]}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={logOut}
                  aria-label="Log out"
                  title="Log out"
                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="size-4" aria-hidden />
                </button>
              </span>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500">
          <BrandLockup logoClassName="h-4 opacity-80" primeClassName="text-[7px]" />
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Stats from LeetCode, GeeksforGeeks, HackerRank, Codeforces, CodeChef and GitHub
            </span>
            <Link to="/privacy" className="font-medium hover:text-slate-700 hover:underline">
              Privacy policy
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
