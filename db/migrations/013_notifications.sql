-- In-app notifications (the bell), optionally also emailed. Sent by super admins and HQ.
-- audience: all = every staff member; hq = HQ and super admins; campus = staff of campus_ids
-- (HQ and super admins see every notification).
create table if not exists notifications (
  id          bigint generated always as identity primary key,
  title       text not null check (length(title) between 1 and 140),
  body        text not null default '' check (length(body) <= 2000),
  link        text,
  level       text not null default 'info' check (level in ('info', 'important', 'urgent')),
  audience    text not null default 'all' check (audience in ('all', 'hq', 'campus')),
  campus_ids  integer[] not null default '{}',
  created_by  text not null,
  created_at  timestamptz not null default now(),
  emailed     integer not null default 0
);

create index if not exists notifications_created_idx on notifications (created_at desc);

create table if not exists notification_reads (
  notification_id  bigint not null references notifications (id) on delete cascade,
  email            text not null,
  read_at          timestamptz not null default now(),
  primary key (notification_id, email)
);
