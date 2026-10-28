-- Campus logos from the LMS (scripts/sync-campuses.ts), shown on campus cards and comparisons.
create table if not exists campuses (
  id         integer primary key,
  code       text,
  logo_url   text,
  synced_at  timestamptz not null default now()
);
