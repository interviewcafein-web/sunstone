-- One row per student on the platform. The list comes from the Sunstone LMS (via Redash):
-- PRIME, active, tech (SST) and FLAGSHIP students; coding usernames come from the Google
-- Form sheet. Filled and refreshed by scripts/import-students.ts.

create table students (
  id                  bigint generated always as identity primary key,
  lms_user_id         integer not null unique,
  -- Public profile address: /s/{username}. Old addresses keep working via legacy_slugs.
  username            text not null,
  legacy_slugs        text[] not null default '{}',
  -- False when the student no longer matches the platform's rules at the last import.
  on_platform         boolean not null default true,

  name                text not null,
  email               text,
  sunstone_email      text,
  mobile              text,
  sunstone_student_id text,
  college_roll_no     text,

  campus_id           integer,
  campus              text not null,
  is_core_campus      boolean not null default false,
  program             text not null,          -- B.Tech, BE, BCA, MCA, Diploma
  course_type         text,                   -- SST (tech) / SSM (management)
  offering_type       text,                   -- FLAGSHIP, SELECT, CORE, CCM
  branch              text,                   -- not in the LMS yet
  admission_year      integer,
  passing_year        integer,

  is_prime            boolean not null default true,
  is_debarred         boolean not null default false,
  debarred_reason     text,
  debarred_until      date,                   -- null with is_debarred = permanent
  is_blocked          boolean not null default false,
  blocked_reason      text,
  is_inactive         boolean not null default false,
  inactive_reason     text,

  leetcode            text,
  geeksforgeeks       text,
  hackerrank          text,
  codeforces          text,
  codechef            text,
  github              text,
  -- Platforms where the form answer was not a usable username.
  invalid_handles     text[] not null default '{}',
  form_submitted_at   timestamptz,

  lms_synced_at       timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index students_username_key on students (lower(username));
create index students_legacy_slugs_idx on students using gin (legacy_slugs);
create index students_email_idx on students (lower(email));
create index students_campus_idx on students (campus, admission_year);
