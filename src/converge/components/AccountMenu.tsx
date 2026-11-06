import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, LogOut, ShieldCheck } from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { ROLE_LABELS } from '@/lib/roles';
import type { SessionInfo } from '@/lib/session';
import { cn } from '@/lib/utils';

/** Their photo (staff who also use Google on Vertex) or initials. */
function Photo({ user, className }: { user: SessionInfo; className?: string }) {
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
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn('size-9 shrink-0 rounded-full object-cover', className)}
    />
  );
}

/** The signed-in person in the header: who they are, their campuses, and Log Out. */
export function AccountMenu({ user, onLogOut }: { user: SessionInfo; onLogOut: () => void }) {
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
        <Photo user={user} className="size-8 ring-2 ring-[#e9c27a]/70" />
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
          <div className="from-brand-700 to-brand-900 relative flex items-center gap-3 overflow-hidden bg-gradient-to-br px-4 py-4 text-white">
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d9a54a] to-transparent"
            />
            <Photo user={user} className="size-12 text-sm ring-2 ring-white/30" />
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
                Your Campuses
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
            <button
              type="button"
              role="menuitem"
              onClick={onLogOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-700 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="size-4" aria-hidden />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
