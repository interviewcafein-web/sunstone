-- Campus issues: campus staff raise operational problems (a fan, the projector, a trainer
-- not deployed, …) from a fixed list of categories; each is assigned to the central team
-- (Tarun Sharma by default) and stays open, and in the weekly email, until it is resolved.
-- See api/issues.ts and src/lib/issues.ts.
create table if not exists issues (
  id           bigint generated always as identity primary key,
  campus_id    integer not null,
  category     text not null,                 -- an id from src/lib/issues.ts
  priority     text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  location     text check (length(location) <= 120),
  details      text not null check (length(details) between 1 and 2000),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  raised_by    text not null,                 -- staff email
  assigned_to  text not null,                 -- staff email
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists issues_campus_idx on issues (campus_id, status);
create index if not exists issues_status_idx on issues (status, created_at desc);

-- The thread under an issue: replies, and every change of status or assignee.
create table if not exists issue_updates (
  id         bigint generated always as identity primary key,
  issue_id   bigint not null references issues (id) on delete cascade,
  author     text not null,                   -- staff email
  kind       text not null check (kind in ('comment', 'status', 'assign')),
  body       text check (length(body) <= 2000),
  status     text,                            -- the new status, for kind = 'status'
  assignee   text,                            -- the new assignee, for kind = 'assign'
  at         timestamptz not null default now()
);

create index if not exists issue_updates_issue_idx on issue_updates (issue_id, at);
