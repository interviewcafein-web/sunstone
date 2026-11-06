import { Outlet, useRouterState } from '@tanstack/react-router';
import { Building2, Crown, Users } from 'lucide-react';

import { BrandLockup } from '@/components/common/BrandLockup';
import { NotificationBell } from '@/components/common/NotificationBell';
import { RequireLogin } from '@/components/common/RequireLogin';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useLogOut, useSession } from '@/lib/session';

import { Link, type ConvergePath } from '../nav';
import { AccountMenu } from './AccountMenu';
import { ConvergeLogo } from './ConvergeLogo';

const NAV: { to: ConvergePath; label: string; icon: typeof Users; exact: boolean }[] = [
  { to: '/', label: 'Students', icon: Users, exact: true },
  { to: '/campuses', label: 'Campuses', icon: Building2, exact: false },
  { to: '/super-100', label: 'Super 100', icon: Crown, exact: false },
];

const navItem =
  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition-all hover:text-brand-700 dark:hover:text-brand-300';
const navItemActive = {
  className:
    'bg-surface text-brand-700 shadow-[0_1px_3px_rgb(15_23_42/0.12)] ring-1 ring-slate-200 dark:text-brand-200',
};

/** Header, page and footer. Every page but the login page needs a signed-in staff member. */
export function Layout() {
  const session = useSession();
  const logOut = useLogOut();
  const user = session.data;
  const onLoginPage = useRouterState({ select: (state) => state.location.pathname === '/login' });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-surface/85 sticky top-0 z-30 backdrop-blur-md">
        {/* Navy to gold, the Converge colours. */}
        <div
          aria-hidden
          className="from-brand-700 via-brand-500 animate-shimmer h-[3px] bg-gradient-to-r to-[#d9a54a]"
        />
        <div className="border-b border-slate-200/80 shadow-[0_8px_24px_-18px_rgb(15_23_42/0.35)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
            <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="Converge home">
              <ConvergeLogo className="h-7 sm:h-9" />
              <span className="hidden items-center self-stretch border-l border-slate-300 pl-3 sm:flex">
                <BrandLockup logoClassName="h-3.5" primeClassName="text-[7px]" />
              </span>
            </Link>

            {user && !onLoginPage && (
              <nav
                aria-label="Main"
                className="scrollbar-none order-last -mx-1 flex w-full gap-1 overflow-x-auto rounded-full bg-slate-100/80 p-1 md:order-none md:mx-auto md:w-auto"
              >
                {NAV.map(({ to, label, icon: Icon, exact }) => (
                  <Link
                    key={to}
                    to={to}
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
              <ThemeToggle />
              {user && !onLoginPage && (
                <>
                  <NotificationBell />
                  <span aria-hidden className="mx-1 h-6 w-px bg-slate-200" />
                  <AccountMenu user={user} onLogOut={logOut} />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {onLoginPage ? (
          <Outlet />
        ) : (
          <RequireLogin>
            <Outlet />
          </RequireLogin>
        )}
      </main>

      <footer className="bg-surface border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500">
          <span className="flex items-center gap-3">
            <ConvergeLogo className="h-5 opacity-90" />
            <span>Converge · Sunstone PRIME</span>
          </span>
          <span>
            PRIME domain, communication and aptitude, AMCAT, exams and attendance, from the LMS
          </span>
        </div>
      </footer>
    </div>
  );
}
