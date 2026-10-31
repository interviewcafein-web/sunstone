-- Photos on campus issues (optional, up to 4 each), stored on Cloudinary: when an issue is
-- raised and in replies. Each entry is { "url", "width", "height" }; see api/issues.ts.
alter table issues add column if not exists images jsonb not null default '[]';
alter table issue_updates add column if not exists images jsonb not null default '[]';
