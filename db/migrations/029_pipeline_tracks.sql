-- Placement pipeline per student, from the LMS (scripts/sync-placements.ts): how many
-- opportunities they were eligible for and applied to, in how many they were shortlisted in a
-- round, and in how many they reached an interview round (PI, HR, face-to-face, technical, GD).
-- Offers themselves are in placements.
create table if not exists placement_pipeline (
  lms_user_id int primary key,
  eligible int not null default 0,
  applied int not null default 0,
  shortlisted int not null default 0,
  interviews int not null default 0,
  last_applied date
);

-- Special tracks a student is in, set by HQ from their own lists (e.g. the Centre of Excellence
-- buckets "DE Tech", "SE-Tech", "SE-Functional", "Functional / Presales"). Names are not
-- stored here: only the LMS user and the track.
create table if not exists student_tracks (
  lms_user_id int primary key,
  program text not null default 'COE',
  track text not null,
  updated_at timestamptz not null default now()
);
