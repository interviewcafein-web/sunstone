import { Link, Outlet, createRootRoute } from '@tanstack/react-router';

import { BrandLockup } from '@/components/common/BrandLockup';

export const Route = createRootRoute({
  component: RootComponent,
});

const navLink =
  'hover:bg-brand-50 hover:text-brand-700 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors';
const navLinkActive = { className: 'bg-brand-50 text-brand-700' };

function RootComponent() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <BrandLockup />
            <span className="self-stretch border-l border-slate-300 pl-3 text-sm leading-[2.6rem] font-medium text-slate-600">
              Coding Profiles
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
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
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500">
          <BrandLockup logoClassName="h-4 opacity-80" primeClassName="text-[7px]" />
          <span>
            Stats from LeetCode, GeeksforGeeks, HackerRank, Codeforces, CodeChef and GitHub
          </span>
        </div>
      </footer>
    </div>
  );
}
