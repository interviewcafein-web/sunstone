import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  BellOff,
  Building2,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  Mail,
  Megaphone,
  Send,
  Users,
  X,
} from 'lucide-react';

import {
  useMarkRead,
  useNotifications,
  useSendNotification,
  type Notification,
  type NotificationAudience,
  type NotificationLevel,
} from '@/lib/notifications';
import { cn } from '@/lib/utils';

const LEVELS: Record<
  NotificationLevel,
  { label: string; icon: LucideIcon; color: string; tint: string }
> = {
  info: { label: 'Update', icon: Info, color: '#3863a0', tint: '#3863a01a' },
  important: { label: 'Important', icon: AlertTriangle, color: '#d97706', tint: '#d977061a' },
  urgent: { label: 'Urgent', icon: AlertOctagon, color: '#dc2626', tint: '#dc26261a' },
};

function ago(at: number) {
  const seconds = Math.max(0, (Date.now() - at) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** The bell in the header: unread badge, the latest notifications, and (for HQ) Send. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const notifications = useNotifications(true);
  const markRead = useMarkRead();
  const box = useRef<HTMLDivElement>(null);
  const data = notifications.data;
  const unread = data?.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !box.current?.contains(event.target as Node)
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

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className={cn(
          'relative flex size-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900',
          open && 'bg-slate-100 text-slate-900'
        )}
      >
        <Bell className={cn('size-5', unread > 0 && 'bell-ring')} aria-hidden />
        {unread > 0 && (
          <span className="animate-pop absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white ring-2 ring-surface">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="animate-rise bg-surface absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 shadow-[0_24px_60px_-20px_rgb(15_23_42/0.45)]"
        >
          <div className="from-brand-700 to-brand-900 flex items-center justify-between gap-2 bg-gradient-to-br px-4 py-3 text-white">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold">
                <Bell className="size-4" aria-hidden />
                Notifications
              </p>
              <p className="text-brand-200 text-[11px]">
                {unread ? `${unread} unread` : 'You are all caught up'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markRead.mutate(undefined)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white/90 hover:bg-white/10"
                >
                  <CheckCheck className="size-3.5" aria-hidden />
                  Mark all read
                </button>
              )}
              {data?.canSend && (
                <button
                  type="button"
                  onClick={() => {
                    setComposing(true);
                    setOpen(false);
                  }}
                  className="text-brand-800 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold shadow-sm transition hover:-translate-y-px"
                >
                  <Megaphone className="size-3.5" aria-hidden />
                  Send
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
            {notifications.isPending ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex gap-3">
                    <div className="skeleton size-9 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-2/3 rounded" />
                      <div className="skeleton h-2.5 w-full rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.isError ? (
              <p className="p-6 text-center text-sm text-slate-500">
                {notifications.error.message}
              </p>
            ) : !data?.items.length ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100">
                  <BellOff className="size-5 text-slate-400" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-700">No notifications yet</p>
                <p className="text-xs text-slate-500">
                  Important updates from HQ will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.items.map((item) => (
                  <NotificationItem
                    key={item.id}
                    item={item}
                    onOpen={() => {
                      if (!item.read) markRead.mutate([item.id]);
                      if (item.link) setOpen(false);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {composing && data && (
        <ComposeDialog campuses={data.campuses} onClose={() => setComposing(false)} />
      )}
    </div>
  );
}

function NotificationItem({ item, onOpen }: { item: Notification; onOpen: () => void }) {
  const router = useRouter();
  const level = LEVELS[item.level];
  const Icon = level.icon;
  const content = (
    <>
      <span
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: level.tint, color: level.color }}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn('text-sm text-slate-800', !item.read && 'font-bold')}>
            {item.title}
          </span>
          {!item.read && (
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-[#3b82f6]"
              aria-label="Unread"
            />
          )}
        </span>
        {item.body && (
          <span className="mt-0.5 line-clamp-3 block text-xs leading-relaxed whitespace-pre-line text-slate-500">
            {item.body}
          </span>
        )}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
          {item.level !== 'info' && (
            <span className="font-semibold" style={{ color: level.color }}>
              {level.label}
            </span>
          )}
          <span>{ago(item.at)}</span>
          <span>· {item.sender}</span>
          {item.link && (
            <span className="text-brand-600 dark:text-brand-300 inline-flex items-center gap-0.5 font-semibold">
              Open <ExternalLink className="size-3" aria-hidden />
            </span>
          )}
        </span>
      </span>
    </>
  );
  const className = cn(
    'flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50',
    !item.read && 'bg-brand-500/5'
  );
  return (
    <li>
      {item.link?.startsWith('/') ? (
        <button
          type="button"
          onClick={() => {
            onOpen();
            router.history.push(item.link!);
          }}
          className={className}
        >
          {content}
        </button>
      ) : item.link ? (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
          className={className}
        >
          {content}
        </a>
      ) : (
        <button type="button" onClick={onOpen} className={className}>
          {content}
        </button>
      )}
    </li>
  );
}

const input =
  'focus-visible:outline-brand-500 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm transition focus:bg-surface focus-visible:outline-2 focus-visible:outline-offset-1';

/** HQ's form for a new notification: who gets it, how loud it is, and whether to email too. */
function ComposeDialog({
  campuses,
  onClose,
}: {
  campuses: { id: number; name: string }[];
  onClose: () => void;
}) {
  const send = useSendNotification();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [level, setLevel] = useState<NotificationLevel>('info');
  const [audience, setAudience] = useState<NotificationAudience>('all');
  const [campusIds, setCampusIds] = useState<number[]>([]);
  const [email, setEmail] = useState(true);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  const audiences: { id: NotificationAudience; label: string; note: string; icon: LucideIcon }[] = [
    { id: 'all', label: 'Everyone', note: 'All staff', icon: Users },
    { id: 'hq', label: 'HQ Only', note: 'HQ and super admins', icon: Megaphone },
    { id: 'campus', label: 'Campuses', note: 'Staff of chosen campuses', icon: Building2 },
  ];

  if (send.isSuccess) {
    return (
      <Modal onClose={onClose}>
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="animate-pop flex size-14 items-center justify-center rounded-full bg-[#10b981]/15">
            <CheckCircle2 className="size-8 text-[#10b981]" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-bold">Notification sent</p>
          <p className="mt-1 text-sm text-slate-500">
            It is in everyone&rsquo;s bell now
            {send.data.emailed ? `, and emailed to ${send.data.emailed} people` : ''}.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="bg-brand-700 hover:bg-brand-800 mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate({ title, body, link: link || undefined, level, audience, campusIds, email });
        }}
      >
        <div className="from-brand-700 to-brand-900 flex items-center justify-between bg-gradient-to-br px-5 py-4 text-white">
          <div>
            <p className="flex items-center gap-2 font-bold">
              <Megaphone className="size-4" aria-hidden />
              Send a notification
            </p>
            <p className="text-brand-200 text-xs">Shows in the bell, and by email if you choose.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <div>
            <label htmlFor="n-title" className="mb-1 block text-xs font-semibold text-slate-600">
              Title
            </label>
            <input
              id="n-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={140}
              required
              autoFocus
              placeholder="e.g. Mock tests scheduled for next week"
              className={input}
            />
          </div>
          <div>
            <label htmlFor="n-body" className="mb-1 block text-xs font-semibold text-slate-600">
              Message
            </label>
            <textarea
              id="n-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="What do people need to know or do?"
              className={cn(input, 'resize-y')}
            />
          </div>
          <div>
            <label htmlFor="n-link" className="mb-1 block text-xs font-semibold text-slate-600">
              Link{' '}
              <span className="font-normal text-slate-400">
                (optional: a page in Vertex like /insights, or https://…)
              </span>
            </label>
            <input
              id="n-link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="/insights"
              className={input}
            />
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-slate-600">How important</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(LEVELS) as NotificationLevel[]).map((id) => {
                const item = LEVELS[id];
                const Icon = item.icon;
                const on = level === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setLevel(id)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition',
                      on
                        ? 'border-transparent shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                    style={
                      on
                        ? {
                            background: item.tint,
                            color: item.color,
                            boxShadow: `inset 0 0 0 1.5px ${item.color}`,
                          }
                        : undefined
                    }
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-slate-600">Who gets it</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {audiences.map(({ id, label, note, icon: Icon }) => {
                const on = audience === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAudience(id)}
                    className={cn(
                      'rounded-xl border p-2.5 text-left transition',
                      on
                        ? 'border-brand-400 bg-brand-500/10 ring-brand-400 ring-1'
                        : 'border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                      <Icon className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
                      {label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{note}</span>
                  </button>
                );
              })}
            </div>
            {audience === 'campus' && (
              <div className="animate-rise mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {campuses.map((campus) => (
                  <label
                    key={campus.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={campusIds.includes(campus.id)}
                      onChange={(event) =>
                        setCampusIds(
                          event.target.checked
                            ? [...campusIds, campus.id]
                            : campusIds.filter((id) => id !== campus.id)
                        )
                      }
                      className="accent-brand-600 size-4"
                    />
                    {campus.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={email}
              onChange={(event) => setEmail(event.target.checked)}
              className="accent-brand-600 mt-0.5 size-4"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Mail className="size-4 text-slate-500" aria-hidden />
                Also send by email
              </span>
              <span className="block text-xs text-slate-500">
                A branded email to each person it reaches, as well as the bell.
              </span>
            </span>
          </label>

          {send.isError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {send.error.message}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              send.isPending || !title.trim() || (audience === 'campus' && !campusIds.length)
            }
            className="from-brand-600 to-brand-800 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50"
          >
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {send.isPending ? 'Sending…' : 'Send Notification'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Rendered on <body>: the header's backdrop blur would otherwise trap a fixed overlay. */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0f172a]/50 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="animate-rise bg-surface w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
