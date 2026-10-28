import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Building2, ChevronDown, LogOut, ShieldCheck, UserRound, Users } from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { ROLE_LABELS } from '@/lib/roles';
import type { SessionInfo } from '@/lib/session';
import { cn } from '@/lib/utils';

/** Their Google photo when they signed in with Google, otherwise their initials. */
export function ProfilePhoto({ user, className }: { user: SessionInfo; className?: string }) {
  const [broken, setBroken] = useState(false);
  // No name yet: initials from the email's letters ("93mishra@…" → "M", not "9").
  const label =
    user.name ??
    (user.user
      .split('@')[0]
      .replace(/[^a-z]+/gi, ' ')
      .trim() ||
      user.user);
  if (!user.picture || broken) return <Avatar name={label} className={className} />;
  return (
    <img
      src={user.picture}
      alt=""
      // Google's image host refuses some requests that carry a referrer.
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn('size-9 shrink-0 rounded-full object-cover', className)}
    />
  );
}

const item =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100';

/** The signed-in person's photo in the header; opens their account menu. */
export function ProfileMenu({ user, onLogOut }: { user: SessionInfo; onLogOut: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !root.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const name = user.name ?? user.user;

  return (
    <div ref={root} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className={cn(
          'flex items-center gap-1 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-slate-100',
          open && 'bg-slate-100'
        )}
      >
        <ProfilePhoto user={user} className="ring-brand-200 dark:ring-brand-800 size-8 ring-2" />
        <ChevronDown
          className={cn('size-3.5 text-slate-500 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="bg-surface animate-rise absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 shadow-[0_20px_50px_-15px_rgb(15_23_42/0.35)]"
        >
          <div className="from-brand-700 to-brand-900 flex items-center gap-3 bg-gradient-to-br px-4 py-4 text-white">
            <ProfilePhoto user={user} className="size-12 text-sm ring-2 ring-white/30" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              {user.designation && (
                <p className="text-brand-100 truncate text-xs">{user.designation}</p>
              )}
              {user.name && <p className="text-brand-100 truncate text-xs">{user.user}</p>}
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                <ShieldCheck className="size-3" aria-hidden />
                {ROLE_LABELS[user.role]}
              </span>
            </div>
          </div>

          {user.campuses && (
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Your campuses
              </p>
              <ul className="space-y-1">
                {user.campuses.map((campus) => (
                  <li key={campus.id} className="flex items-center gap-2 text-sm">
                    <Building2 className="size-3.5 text-slate-400" aria-hidden />
                    {campus.name}
                  </li>
                ))}
                {!user.campuses.length && (
                  <li className="text-sm text-slate-500">None yet: ask HQ to add one.</li>
                )}
              </ul>
            </div>
          )}

          <div className="p-1.5">
            <Link to="/account" role="menuitem" className={item} onClick={() => setOpen(false)}>
              <UserRound className="size-4 text-slate-500" aria-hidden />
              My profile
            </Link>
            {user.managesTeam && (
              <Link to="/team" role="menuitem" className={item} onClick={() => setOpen(false)}>
                <Users className="size-4 text-slate-500" aria-hidden />
                Manage team
              </Link>
            )}
            <Link to="/privacy" role="menuitem" className={item} onClick={() => setOpen(false)}>
              <ShieldCheck className="size-4 text-slate-500" aria-hidden />
              Privacy policy
            </Link>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              role="menuitem"
              onClick={onLogOut}
              className={cn(
                item,
                'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
              )}
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
