import { Link, Outlet, createRootRoute, useRouterState } from '@tanstack/react-router';
import { Building2, Library, LogIn, Radar, Users } from 'lucide-react';

import { BrandLockup } from '@/components/common/BrandLockup';
import { NotificationBell } from '@/components/common/NotificationBell';
import { ProfileMenu } from '@/components/common/ProfileMenu';
import { VertexLogo } from '@/components/common/VertexLogo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useLogOut, useSession } from '@/lib/session';

export const Route = createRootRoute({
  component: RootComponent,
});

const NAV = [
  { to: '/', label: 'Students', icon: Users, exact: true },
  { to: '/campuses', label: 'Campuses', icon: Building2, exact: false },
  { to: '/insights', label: '360° view', icon: Radar, exact: false },
  { to: '/resources', label: 'Resources', icon: Library, exact: false },
] as const;

const navItem =
  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition-all hover:text-brand-700 dark:hover:text-brand-300';
const navItemActive = {
  className:
    'bg-surface text-brand-700 shadow-[0_1px_3px_rgb(15_23_42/0.12)] ring-1 ring-slate-200 dark:text-brand-200',
};

function RootComponent() {
  const session = useSession();
  const logOut = useLogOut();
  const user = session.data;
  // The login page is the sign-in form itself; a "Staff login" button there only repeats it.
  const onLoginPage = useRouterState({ select: (state) => state.location.pathname === '/login' });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-md">
        {/* Navy-to-gold accent: the Sunstone PRIME and Vertex colours. */}
        <div
          aria-hidden
          className="from-brand-700 via-brand-500 h-[3px] bg-gradient-to-r to-amber-400"
        />
        <div className="border-b border-slate-200/80 shadow-[0_8px_24px_-18px_rgb(15_23_42/0.35)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-3"
              aria-label="Sunstone PRIME Vertex home"
            >
              <BrandLockup logoClassName="h-4 sm:h-5" primeClassName="text-[7px] sm:text-[9px]" />
              <span className="flex items-center self-stretch border-l border-slate-300 pl-3">
                <VertexLogo className="h-6 sm:h-8" />
              </span>
            </Link>

            {user && (
              <nav
                aria-label="Main"
                className="order-last -mx-1 flex w-full gap-1 overflow-x-auto rounded-full bg-slate-100/80 p-1 scrollbar-none md:order-none md:mx-auto md:w-auto"
              >
                {NAV.map(({ to, label, icon: Icon, exact }) => (
                  <Link
                    key={to}
                    to={to}
                    data-tour={`nav-${to === '/' ? 'students' : to.slice(1)}`}
                    className={navItem}
                    activeProps={navItemActive}
                    activeOptions={{ exact, includeSearch: false }}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </Link>
                ))}
              </nav>
            )}

            <div className="ml-auto flex items-center gap-1 md:ml-0">
              {!user && !session.isPending && !onLoginPage && (
                <Link
                  to="/login"
                  className="bg-brand-700 hover:bg-brand-800 mr-1 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold text-white"
                >
                  <LogIn className="size-4" aria-hidden />
                  Staff login
                </Link>
              )}
              <span data-tour="theme" className="inline-flex">
                <ThemeToggle />
              </span>
              {user && (
                <>
                  <span data-tour="bell" className="inline-flex">
                    <NotificationBell />
                  </span>
                  <span aria-hidden className="mx-1 h-6 w-px bg-slate-200" />
                  <ProfileMenu user={user} onLogOut={logOut} />
                </>
              )}
            </div>
          </div>
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
