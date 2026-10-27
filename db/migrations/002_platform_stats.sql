-- The last known coding stats for each (platform, username), shared by everyone who opens
-- the site: pages show these instantly and refresh them from the platforms in the
-- background (see api/cache.ts). Keyed by username rather than student, exactly as the
-- app's query cache is.

create table platform_stats (
  platform    text not null,
  handle      text not null,
  -- The students table's one-line numbers (solved, rating, last active): PlatformSummary.
  summary     jsonb,
  summary_at  timestamptz,
  -- The full profile page data: CodingProfile. Saved when someone opens the profile.
  profile     jsonb,
  profile_at  timestamptz,
  primary key (platform, handle)
);
