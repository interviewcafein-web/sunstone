import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getRouteApi } from '@tanstack/react-router';
import {
  ArrowRightLeft,
  Armchair,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Fan,
  Flag,
  HelpCircle,
  Laptop,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Presentation,
  RotateCcw,
  Send,
  UserCheck,
  UserX,
  Users,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import {
  ISSUE_CATEGORIES,
  PRIORITIES,
  ago,
  categoryLabel,
  categoryOf,
  priorityOf,
  statusOf,
  type Issue,
  type IssueCategoryId,
  type IssuePriority,
  type IssueUpdate,
  type IssuesResponse,
  type Person,
} from '@/lib/issues';
import {
  useAssign,
  useIssue,
  useIssues,
  useRaiseIssue,
  useReply,
  useSetStatus,
  type IssueFilter,
} from '@/lib/issuesApi';
import { cn } from '@/lib/utils';

const route = getRouteApi('/issues');

const CATEGORY_ICONS: Record<IssueCategoryId, LucideIcon> = {
  internet: Wifi,
  display: Presentation,
  cooling: Fan,
  power: Zap,
  tech: Laptop,
  room: Armchair,
  trainer: UserX,
  classes: CalendarClock,
  lms: BookOpen,
  students: Users,
  other: HelpCircle,
};

const field =
  'focus-visible:outline-brand-500 w-full rounded-xl border border-slate-300 bg-surface px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1';
const primaryButton =
  'bg-brand-700 hover:bg-brand-800 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50';
const quietButton =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-surface px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50';

const personName = (person: Person) => person.name ?? person.email.split('@')[0];

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ color, background: `${color}18` }}
    >
      {label}
    </span>
  );
}

/** Campus issues: raise, follow and resolve the operational problems at each campus. */
export default function IssuesPage() {
  const { id, status = 'active', campus, raise, mine } = route.useSearch();
  const navigate = route.useNavigate();
  const setSearch = (patch: Record<string, unknown>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const issues = useIssues(status as IssueFilter, campus, true, mine);
  const data = issues.data;

  return (
    <div className="rise-stagger space-y-5">
      <section className="from-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-1/4 size-72 rounded-full bg-amber-400/20 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-brand-200 text-xs font-semibold tracking-[0.2em] uppercase">
              Campus Operations
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <Flag className="size-7" aria-hidden />
              Campus Issues
            </h1>
            <p className="text-brand-100 mt-2 text-sm">
              Raise anything that gets in the way of classes: a fan, the projector, a trainer not
              deployed. Each issue goes to the central team and stays open, and in the weekly email,
              until it is resolved.
            </p>
            {data && (
              <p className="mt-3 text-sm font-semibold text-amber-200">
                {data.openCount === 0
                  ? 'Nothing open right now.'
                  : `${data.openCount} open ${data.openCount === 1 ? 'issue' : 'issues'}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSearch({ raise: true })}
            disabled={!data?.campuses.length}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 shadow-lg transition hover:bg-amber-300 disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden />
            Raise an Issue
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full bg-slate-100 p-1" role="tablist">
          {(['active', 'resolved', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              onClick={() => setSearch({ status: value === 'active' ? undefined : value })}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-semibold text-slate-600',
                status === value && 'bg-surface text-brand-700 shadow ring-1 ring-slate-200'
              )}
            >
              {value === 'active' ? 'Open' : value === 'resolved' ? 'Resolved' : 'All'}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={Boolean(mine)}
          onClick={() => setSearch({ mine: mine ? undefined : true })}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition',
            mine
              ? 'border-brand-700 bg-brand-700 text-white'
              : 'bg-surface border-slate-300 text-slate-600 hover:border-slate-400'
          )}
        >
          <UserCheck className="size-4" aria-hidden />
          Assigned to Me
          {data && data.mineCount > 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 text-[11px] leading-4 font-bold',
                mine ? 'bg-white/25 text-white' : 'bg-red-500 text-white'
              )}
            >
              {data.mineCount}
            </span>
          )}
        </button>
        {data && data.campuses.length > 1 && (
          <select
            value={campus ?? ''}
            onChange={(event) =>
              setSearch({ campus: event.target.value ? Number(event.target.value) : undefined })
            }
            aria-label="Campus"
            className="bg-surface rounded-full border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All Campuses</option>
            {data.campuses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {issues.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
      ) : issues.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {issues.error.message}
        </p>
      ) : !data?.issues.length ? (
        <div className="bg-surface shadow-card flex flex-col items-center rounded-2xl border border-slate-200 px-6 py-12 text-center">
          <CheckCircle2 className="size-10 text-emerald-500" aria-hidden />
          <h2 className="mt-3 text-lg font-bold">
            {status === 'resolved' ? 'Nothing Resolved Yet' : 'No Open Issues'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            When something gets in the way at a campus, raise it here and the central team picks it
            up.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onOpen={() => setSearch({ id: issue.id })} />
          ))}
        </div>
      )}

      {raise && data && (
        <RaiseDialog
          data={data}
          onClose={() => setSearch({ raise: undefined })}
          onRaised={(newId) => setSearch({ raise: undefined, id: newId, status: undefined })}
        />
      )}
      {id && data && (
        <IssueDialog id={id} data={data} onClose={() => setSearch({ id: undefined })} />
      )}
    </div>
  );
}

function IssueCard({ issue, onOpen }: { issue: Issue; onOpen: () => void }) {
  const Icon = CATEGORY_ICONS[categoryOf(issue.category)];
  const priority = priorityOf(issue.priority);
  const state = statusOf(issue.status);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-surface shadow-card hover-lift group relative overflow-hidden rounded-2xl border border-slate-200 p-4 text-left transition"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: issue.status === 'resolved' ? state.color : priority.color }}
      />
      <div className="flex items-start gap-3">
        <span className="bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200 flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge label={state.label} color={state.color} />
            {issue.priority !== 'normal' && <Badge label={priority.label} color={priority.color} />}
          </div>
          <h3 className="mt-1 font-bold text-slate-900">{categoryLabel(issue.category)}</h3>
          <p className="truncate text-xs text-slate-500">
            {issue.campus}
            {issue.location && ` · ${issue.location}`}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-700">{issue.details}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          Raised by <b className="text-slate-700">{personName(issue.raisedBy)}</b>{' '}
          {ago(issue.createdAt)}
        </span>
        <span>
          Assigned to <b className="text-slate-700">{personName(issue.assignedTo)}</b>
        </span>
        {issue.replies > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" aria-hidden />
            {issue.replies}
          </span>
        )}
      </div>
    </button>
  );
}

function Modal({
  children,
  onClose,
  wide,
}: {
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0f172a]/50 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'animate-rise bg-surface w-full overflow-hidden rounded-2xl shadow-2xl',
          wide ? 'max-w-2xl' : 'max-w-lg'
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function DialogHeader({
  title,
  kicker,
  onClose,
}: {
  title: string;
  kicker?: string;
  onClose: () => void;
}) {
  return (
    <div className="from-brand-700 to-brand-900 flex items-start justify-between gap-3 bg-gradient-to-br px-5 py-4 text-white">
      <div className="min-w-0">
        {kicker && <p className="text-brand-200 text-xs font-semibold">{kicker}</p>}
        <h2 className="truncate text-lg font-bold">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}

function RaiseDialog({
  data,
  onClose,
  onRaised,
}: {
  data: IssuesResponse;
  onClose: () => void;
  onRaised: (id: number) => void;
}) {
  const raise = useRaiseIssue();
  const [campusId, setCampusId] = useState<number | ''>(
    data.campuses.length === 1 ? data.campuses[0].id : ''
  );
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('normal');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!campusId) return setError('Choose the campus.');
    if (!category) return setError('Choose what the issue is about.');
    if (!details.trim()) return setError('Describe the issue.');
    raise.mutate(
      {
        campusId,
        category,
        priority,
        location: location.trim() || undefined,
        details: details.trim(),
      },
      {
        onSuccess: (result) => onRaised((result.issue as Issue).id),
        onError: (problem) => setError(problem.message),
      }
    );
  };

  return (
    <Modal onClose={onClose}>
      <DialogHeader kicker="Goes to the central team" title="Raise an Issue" onClose={onClose} />
      <form onSubmit={submit} className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
        {data.campuses.length > 1 && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Campus</span>
            <select
              value={campusId}
              onChange={(event) =>
                setCampusId(event.target.value ? Number(event.target.value) : '')
              }
              className={field}
            >
              <option value="">Choose a campus</option>
              {data.campuses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-slate-600">What Is It About?</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ISSUE_CATEGORIES.map((item) => {
              const Icon = CATEGORY_ICONS[item.id];
              const chosen = category === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => setCategory(item.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition',
                    chosen
                      ? 'border-brand-700 bg-brand-700 text-white'
                      : 'border-slate-300 text-slate-700 hover:border-slate-400'
                  )}
                >
                  <Icon
                    className={cn('size-4 shrink-0', !chosen && 'text-brand-600')}
                    aria-hidden
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-slate-600">How Urgent?</legend>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITIES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={priority === item.id}
                onClick={() => setPriority(item.id)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                style={
                  priority === item.id
                    ? { borderColor: item.color, background: `${item.color}14`, color: item.color }
                    : undefined
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Where? (Optional)</span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            maxLength={120}
            placeholder="e.g. Lab 2, Block A"
            className={field}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Details</span>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="What is wrong, since when, and how it affects classes"
            className={field}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={quietButton}>
            Cancel
          </button>
          <button type="submit" disabled={raise.isPending} className={primaryButton}>
            {raise.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Flag className="size-4" aria-hidden />
            )}
            Raise Issue
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UpdateLine({ update }: { update: IssueUpdate }) {
  if (update.kind === 'comment') {
    return (
      <li className="rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/40">
        <p className="text-xs text-slate-500">
          <b className="text-slate-700">{personName(update.author)}</b> · {ago(update.at)}
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-slate-800">{update.body}</p>
      </li>
    );
  }
  const what =
    update.kind === 'assign'
      ? update.assignee?.email === update.author.email
        ? 'took it on'
        : `assigned it to ${update.assignee ? personName(update.assignee) : 'someone'}`
      : update.status === 'resolved'
        ? 'marked it resolved'
        : update.status === 'open'
          ? 'reopened it'
          : 'started work on it';
  return (
    <li className="flex items-start gap-2 px-1 text-xs text-slate-500">
      {update.kind === 'assign' ? (
        <ArrowRightLeft className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      ) : (
        <CircleDot className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      )}
      <span>
        <b className="text-slate-700">{personName(update.author)}</b> {what} · {ago(update.at)}
        {update.body && <span className="mt-0.5 block text-slate-600">“{update.body}”</span>}
      </span>
    </li>
  );
}

function IssueDialog({
  id,
  data,
  onClose,
}: {
  id: number;
  data: IssuesResponse;
  onClose: () => void;
}) {
  const found = useIssue(id);
  const reply = useReply();
  const setStatus = useSetStatus();
  const assign = useAssign();
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const issue = found.data?.issue;

  const canChange = Boolean(issue && (data.manages || issue.assignedTo.email === data.me));
  const canReopen = Boolean(
    issue && issue.status === 'resolved' && (canChange || issue.raisedBy.email === data.me)
  );
  const busy = reply.isPending || setStatus.isPending || assign.isPending;
  const team = useMemo(() => data.team, [data.team]);

  const fail = (problem: Error) => setError(problem.message);

  return (
    <Modal onClose={onClose} wide>
      <DialogHeader
        kicker={
          issue ? `${issue.campus}${issue.location ? ` · ${issue.location}` : ''}` : 'Campus Issue'
        }
        title={issue ? categoryLabel(issue.category) : 'Loading…'}
        onClose={onClose}
      />
      {found.isPending ? (
        <div className="space-y-3 p-5">
          <div className="skeleton h-5 w-1/3 rounded" />
          <div className="skeleton h-20 rounded-xl" />
        </div>
      ) : found.error || !issue ? (
        <p className="p-5 text-sm text-red-700">{found.error?.message ?? 'Issue not found.'}</p>
      ) : (
        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={statusOf(issue.status).label} color={statusOf(issue.status).color} />
            <Badge
              label={`${priorityOf(issue.priority).label} Priority`}
              color={priorityOf(issue.priority).color}
            />
            <span className="text-xs text-slate-500">
              Raised by <b className="text-slate-700">{personName(issue.raisedBy)}</b>{' '}
              {ago(issue.createdAt)} · Assigned to{' '}
              <b className="text-slate-700">{personName(issue.assignedTo)}</b>
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap text-slate-800">{issue.details}</p>
          {issue.location && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="size-3.5" aria-hidden />
              {issue.location}
            </p>
          )}

          {canChange && issue.status !== 'resolved' && (
            <div className="rounded-2xl border border-slate-200 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <UserCheck className="size-3.5" aria-hidden />
                Responsible
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={issue.assignedTo.email}
                  disabled={busy}
                  onChange={(event) =>
                    assign.mutate({ id, assignee: event.target.value }, { onError: fail })
                  }
                  aria-label="Assigned to"
                  className={cn(field, 'w-auto min-w-64 flex-1')}
                >
                  {!team.some((member) => member.email === issue.assignedTo.email) && (
                    <option value={issue.assignedTo.email}>{personName(issue.assignedTo)}</option>
                  )}
                  <optgroup label="Central Team (HQ)">
                    {team
                      .filter((member) => member.role !== 'campus')
                      .map((member) => (
                        <option key={member.email} value={member.email}>
                          {personName(member)}
                          {member.email === data.me ? ' (You)' : ''}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Campus Staff">
                    {team
                      .filter((member) => member.role === 'campus')
                      .map((member) => (
                        <option key={member.email} value={member.email}>
                          {personName(member)}
                          {member.campus ? ` · ${member.campus}` : ''}
                          {member.email === data.me ? ' (You)' : ''}
                        </option>
                      ))}
                  </optgroup>
                </select>
                {data.manages && issue.assignedTo.email !== data.me && (
                  <button
                    type="button"
                    disabled={busy}
                    className={quietButton}
                    onClick={() => assign.mutate({ id, assignee: data.me }, { onError: fail })}
                  >
                    <UserCheck className="size-4" aria-hidden />
                    Assign to Me
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Whoever holds it is responsible: they update the status, and can hand it on.
              </p>
            </div>
          )}

          {(canChange || canReopen) && (
            <div className="rounded-2xl border border-slate-200 p-3.5">
              <p className="mb-2 text-xs font-semibold text-slate-600">Update the Status</p>
              {issue.status !== 'resolved' && canChange && (
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={2000}
                  placeholder="Note for the campus (optional), e.g. electrician visiting tomorrow"
                  className={cn(field, 'mb-2')}
                />
              )}
              <div className="flex flex-wrap gap-2">
                {issue.status === 'open' && canChange && (
                  <button
                    type="button"
                    disabled={busy}
                    className={quietButton}
                    onClick={() =>
                      setStatus.mutate(
                        { id, status: 'in_progress', note: note.trim() || undefined },
                        { onSuccess: () => setNote(''), onError: fail }
                      )
                    }
                  >
                    <CircleDot className="size-4 text-amber-600" aria-hidden />
                    Start Work
                  </button>
                )}
                {issue.status !== 'resolved' && canChange && (
                  <button
                    type="button"
                    disabled={busy}
                    className={cn(primaryButton, 'bg-emerald-600 hover:bg-emerald-700')}
                    onClick={() =>
                      setStatus.mutate(
                        { id, status: 'resolved', note: note.trim() || undefined },
                        { onSuccess: () => setNote(''), onError: fail }
                      )
                    }
                  >
                    <CheckCircle2 className="size-4" aria-hidden />
                    Mark Resolved
                  </button>
                )}
                {canReopen && (
                  <button
                    type="button"
                    disabled={busy}
                    className={quietButton}
                    onClick={() => setStatus.mutate({ id, status: 'open' }, { onError: fail })}
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    Reopen
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-bold">Updates</h3>
            {found.data.updates.length ? (
              <ul className="space-y-2">
                {found.data.updates.map((update) => (
                  <UpdateLine key={update.id} update={update} />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">No replies yet.</p>
            )}
          </div>

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!message.trim()) return;
              reply.mutate(
                { id, body: message.trim() },
                { onSuccess: () => setMessage(''), onError: fail }
              );
            }}
          >
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Write a reply"
              className={field}
            />
            <button type="submit" disabled={busy || !message.trim()} className={primaryButton}>
              {reply.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              Reply
            </button>
          </form>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
