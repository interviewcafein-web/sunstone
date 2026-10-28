import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Check,
  Crown,
  Globe2,
  Loader2,
  Lock,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';

import { Avatar } from '@/components/common/Avatar';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from '@/lib/roles';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

interface Member {
  email: string;
  name: string | null;
  picture: string | null;
  designation: string | null;
  mobile: string | null;
  role: Role;
  campusIds: number[];
  addedBy: string | null;
  addedAt: number | null;
  lastLoginAt: number | null;
  editable: boolean;
}

interface Campus {
  id: number;
  name: string;
  students: number;
}

interface TeamResponse {
  members: Member[];
  campuses: Campus[];
  assignable: Role[];
  me: string;
}

interface Draft {
  email: string;
  name: string;
  designation: string;
  mobile: string;
  role: Role;
  campusIds: number[];
  /** Editing an existing member (their email cannot change). */
  existing: boolean;
}

async function call<T>(init?: RequestInit): Promise<T> {
  const response = await fetch('/api/team', init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? 'Something went wrong.');
  return body as T;
}

const post = (body: object) =>
  call<{ ok: true }>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const ROLE_STYLES: Record<Role, string> = {
  super_admin: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  hq: 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200',
  campus: 'bg-slate-100 text-slate-700',
};
const ROLE_ICONS = { super_admin: Crown, hq: Globe2, campus: Building2 };

const field =
  'focus-visible:outline-brand-500 w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 disabled:bg-slate-50 disabled:text-slate-500';

function when(ms: number | null) {
  if (!ms) return 'Never';
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(ms).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Who has access, and to which campuses. Super admins and HQ only (the API enforces it). */
export default function TeamPage() {
  const queryClient = useQueryClient();
  const allowed = Boolean(useSession().data?.managesTeam);
  const team = useQuery({
    queryKey: ['team'],
    queryFn: () => call<TeamResponse>(),
    enabled: allowed,
    retry: false,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string>();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['team'] });

  const save = useMutation({
    mutationFn: (value: Draft) =>
      post({
        action: 'save',
        email: value.email,
        name: value.name,
        designation: value.designation,
        mobile: value.mobile,
        role: value.role,
        campusIds: value.role === 'campus' ? value.campusIds : [],
      }),
    onSuccess: (_, value) => {
      setNotice(
        value.existing
          ? `Updated ${value.email}. Changes apply within a minute.`
          : `Added ${value.email}. They can now sign in with Google or an emailed code.`
      );
      setDraft(null);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (email: string) => post({ action: 'remove', email }),
    onSuccess: (_, email) => {
      setNotice(`Removed ${email}. Their access ends within a minute.`);
      refresh();
    },
  });

  const campusName = useMemo(
    () => new Map((team.data?.campuses ?? []).map((campus) => [campus.id, campus.name])),
    [team.data]
  );

  if (!allowed) {
    return (
      <p className="shadow-card bg-surface flex items-center gap-2 rounded-2xl border border-slate-200 p-5 text-sm text-slate-600">
        <Lock className="size-4" aria-hidden />
        Only super admins and HQ can manage the team.
      </p>
    );
  }
  if (team.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading the team…
      </p>
    );
  }
  if (team.isError) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {team.error.message}
      </p>
    );
  }

  const { members, campuses, assignable } = team.data;
  const counts = members.reduce<Record<Role, number>>(
    (total, member) => ({ ...total, [member.role]: total[member.role] + 1 }),
    { super_admin: 0, hq: 0, campus: 0 }
  );

  return (
    <div className="rise-stagger space-y-5">
      <section className="hero-glow from-brand-700 via-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-brand-200 text-xs font-semibold tracking-[0.2em] uppercase">
              Team &amp; access
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Who can sign in, and what they see
            </h1>
            <p className="text-brand-100 mt-2 max-w-2xl text-sm">
              Everyone signs in with Google or an emailed code. HQ sees every campus; campus teams
              see only their campuses.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setNotice(undefined);
              save.reset();
              setDraft({
                email: '',
                name: '',
                designation: '',
                mobile: '',
                role: 'campus',
                campusIds: [],
                existing: false,
              });
            }}
            className="text-brand-800 hover:bg-brand-50 inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <UserPlus className="size-4" aria-hidden />
            Add person
          </button>
        </div>
        <dl className="relative mt-6 grid grid-cols-3 gap-3">
          {(['super_admin', 'hq', 'campus'] as Role[]).map((role) => {
            const Icon = ROLE_ICONS[role];
            return (
              <div key={role} className="rounded-xl border border-white/15 bg-white/10 p-3">
                <dd className="text-2xl font-bold tabular-nums">{counts[role]}</dd>
                <dt className="text-brand-100 mt-0.5 flex items-center gap-1.5 text-xs">
                  <Icon className="text-brand-200 size-3.5" aria-hidden />
                  {ROLE_LABELS[role]}
                </dt>
              </div>
            );
          })}
        </dl>
      </section>

      {notice && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <Check className="size-4" aria-hidden />
          {notice}
        </p>
      )}

      {draft && (
        <MemberForm
          draft={draft}
          campuses={campuses}
          assignable={assignable}
          busy={save.isPending}
          error={save.error?.message}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSubmit={() => save.mutate(draft)}
        />
      )}

      {remove.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {remove.error.message}
        </p>
      )}

      <section className="shadow-card bg-surface overflow-hidden rounded-2xl border border-slate-200">
        <ul className="divide-y divide-dotted divide-slate-300">
          {members.map((member) => {
            const Icon = ROLE_ICONS[member.role];
            return (
              <li
                key={member.email}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
              >
                {member.picture ? (
                  <img
                    src={member.picture}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <Avatar name={member.name ?? member.email} />
                )}
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate font-semibold">
                    {member.name ?? member.email.split('@')[0]}
                    {member.email === team.data.me && (
                      <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {[member.designation, member.email, member.mobile].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    ROLE_STYLES[member.role]
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {ROLE_LABELS[member.role]}
                </span>
                <div className="min-w-0 basis-64 text-xs text-slate-600 sm:flex-1">
                  {member.role === 'campus' ? (
                    <span className="flex flex-wrap gap-1">
                      {member.campusIds.map((id) => (
                        <span key={id} className="rounded-md border border-slate-200 px-1.5 py-0.5">
                          {campusName.get(id) ?? `Campus ${id}`}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Globe2 className="size-3.5 text-slate-400" aria-hidden />
                      All campuses
                    </span>
                  )}
                </div>
                <div className="w-32 text-xs text-slate-500">
                  <span className="block">Last sign-in</span>
                  <span className="font-medium text-slate-700">{when(member.lastLoginAt)}</span>
                </div>
                <div className="flex w-20 justify-end gap-1">
                  {member.editable ? (
                    <>
                      <button
                        type="button"
                        title="Change access"
                        aria-label={`Change access for ${member.email}`}
                        onClick={() => {
                          setNotice(undefined);
                          save.reset();
                          setDraft({
                            email: member.email,
                            name: member.name ?? '',
                            designation: member.designation ?? '',
                            mobile: member.mobile ?? '',
                            role: member.role,
                            campusIds: member.campusIds,
                            existing: true,
                          });
                        }}
                        className="hover:bg-brand-50 hover:text-brand-700 inline-flex size-8 items-center justify-center rounded-lg text-slate-500"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title="Remove access"
                        aria-label={`Remove access for ${member.email}`}
                        disabled={remove.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${member.email}? They will lose access within a minute.`
                            )
                          ) {
                            setNotice(undefined);
                            remove.mutate(member.email);
                          }
                        }}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </>
                  ) : (
                    <span
                      className="inline-flex size-8 items-center justify-center text-slate-300"
                      title={
                        member.email === team.data.me
                          ? 'You cannot change your own access'
                          : 'Super admins cannot be changed here'
                      }
                    >
                      <Lock className="size-4" aria-hidden />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

interface MemberFormProps {
  draft: Draft;
  campuses: Campus[];
  assignable: Role[];
  busy: boolean;
  error?: string;
  onChange: (draft: Draft) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function MemberForm({
  draft,
  campuses,
  assignable,
  busy,
  error,
  onChange,
  onCancel,
  onSubmit,
}: MemberFormProps) {
  const [filter, setFilter] = useState('');
  const shown = campuses.filter((campus) =>
    campus.name.toLowerCase().includes(filter.toLowerCase().trim())
  );
  const toggle = (id: number) =>
    onChange({
      ...draft,
      campusIds: draft.campusIds.includes(id)
        ? draft.campusIds.filter((campusId) => campusId !== id)
        : [...draft.campusIds, id],
    });

  return (
    <form
      className="shadow-card bg-surface space-y-4 rounded-2xl border border-slate-200 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className="text-brand-700 dark:text-brand-300 size-5" aria-hidden />
          {draft.existing ? `Change access for ${draft.email}` : 'Add a person'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="member-email" className="mb-1 block text-xs font-medium text-slate-600">
            Email (their Google account or work email)
          </label>
          <input
            id="member-email"
            type="email"
            required
            disabled={draft.existing}
            value={draft.email}
            onChange={(event) => onChange({ ...draft, email: event.target.value })}
            placeholder="name@sunstone.in"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="member-name" className="mb-1 block text-xs font-medium text-slate-600">
            Name
          </label>
          <input
            id="member-name"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Full name"
            className={field}
          />
        </div>
        <div>
          <label
            htmlFor="member-designation"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Designation
          </label>
          <input
            id="member-designation"
            value={draft.designation}
            onChange={(event) => onChange({ ...draft, designation: event.target.value })}
            placeholder="e.g. Campus Manager"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="member-mobile" className="mb-1 block text-xs font-medium text-slate-600">
            Mobile
          </label>
          <input
            id="member-mobile"
            type="tel"
            value={draft.mobile}
            onChange={(event) => onChange({ ...draft, mobile: event.target.value })}
            placeholder="+91 98765 43210"
            className={field}
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-slate-600">Access</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {assignable.map((role) => {
            const Icon = ROLE_ICONS[role];
            const selected = draft.role === role;
            return (
              <label
                key={role}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                  selected
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  checked={selected}
                  onChange={() => onChange({ ...draft, role })}
                  className="sr-only"
                />
                <Icon
                  className={cn(
                    'mt-0.5 size-5',
                    selected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400'
                  )}
                  aria-hidden
                />
                <span>
                  <span className="block text-sm font-semibold">
                    {role === 'hq' ? 'HQ (all campuses)' : ROLE_LABELS[role]}
                  </span>
                  <span className="block text-xs text-slate-500">{ROLE_DESCRIPTIONS[role]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {draft.role === 'campus' && (
        <fieldset>
          <legend className="mb-1.5 flex w-full items-center justify-between text-xs font-medium text-slate-600">
            <span>Campuses ({draft.campusIds.length} chosen)</span>
          </legend>
          <div className="relative mb-2">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Find a campus"
              aria-label="Find a campus"
              className={cn(field, 'pl-9')}
            />
          </div>
          <div className="grid max-h-64 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5 sm:grid-cols-2">
            {shown.map((campus) => {
              const checked = draft.campusIds.includes(campus.id);
              return (
                <label
                  key={campus.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                    checked ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-slate-50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(campus.id)}
                    className="accent-brand-700 size-4"
                  />
                  <span className="min-w-0 flex-1 truncate">{campus.name}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{campus.students}</span>
                </label>
              );
            })}
            {!shown.length && <p className="p-2 text-sm text-slate-500">No campus matches.</p>}
          </div>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-700 hover:bg-brand-800 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {draft.existing ? 'Save changes' : 'Add person'}
        </button>
      </div>
    </form>
  );
}
