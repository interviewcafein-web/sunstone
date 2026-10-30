-- Ready-made answers for the heaviest pages (each campus page, the campus list, the 360° numbers),
-- so they open at once. Made after each nightly sync (scripts/warm-snapshots.ts) and remade in
-- the background when older than a few minutes or after a sync (api/_snapshot.ts).
create table if not exists api_snapshots (
  key            text primary key,           -- e.g. "campus:9:" or "campus:9:B.Tech:2025"
  body           jsonb not null,
  version        text not null,              -- the sync times it was made from
  made_at        timestamptz not null default now(),
  refreshing_at  timestamptz                 -- set while one request remakes it
);
