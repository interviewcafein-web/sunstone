-- PRIME domain assessments and AMCAT results, copied from the Sunstone LMS (via Redash) by
-- `npm run db:sync-assessments`. Ids are the LMS's own. Times are as the LMS stores them
-- (India time, no zone).

-- PRIME domain subjects (LMS "course": one per campus/batch, e.g. "Prime Domain Coding").
create table lms_courses (
  id        integer primary key,
  name      text not null,
  modules   integer not null default 0,
  lectures  integer not null default 0
);

-- The syllabus: a course's modules, in order.
create table lms_modules (
  id         integer primary key,
  course_id  integer not null,
  name       text not null,
  position   integer
);
create index lms_modules_course_idx on lms_modules (course_id);

-- Tests. category: 'assignment' (topic problems), 'test' (practice/timed tests), 'mcq',
-- 'amcat_mock' (AMCAT mock tests run on Sunstone).
create table lms_tests (
  id         integer primary key,
  name       text not null,
  category   text not null,
  max_marks  numeric,
  minutes    integer
);

-- A test released to a class section (the LMS's section scope).
create table lms_test_releases (
  test_id     integer not null,
  section_id  integer not null,
  course_id   integer not null,
  module_id   integer,
  release_at  timestamp,
  due_at      timestamp,
  primary key (test_id, section_id)
);
create index lms_test_releases_section_idx on lms_test_releases (section_id);

-- Which of our students are in which section.
create table lms_section_students (
  section_id   integer not null,
  lms_user_id  integer not null,
  primary key (section_id, lms_user_id)
);
create index lms_section_students_user_idx on lms_section_students (lms_user_id);

-- A student's result on a test: their best attempt.
create table lms_test_results (
  test_id       integer not null,
  lms_user_id   integer not null,
  attempts      integer not null,
  marks         numeric,
  max_marks     numeric,
  submitted     boolean not null,
  submitted_at  timestamp,
  primary key (test_id, lms_user_id)
);
create index lms_test_results_user_idx on lms_test_results (lms_user_id);

-- AMCAT sittings, with the score in each section: [{ name, score, total }].
create table amcat_sittings (
  id           integer primary key,
  lms_user_id  integer not null,
  test_name    text not null,
  taken_at     timestamp,
  status       text,
  sections     jsonb not null default '[]'
);
create index amcat_sittings_user_idx on amcat_sittings (lms_user_id);

-- When each sync last ran.
create table sync_state (
  name    text primary key,
  ran_at  timestamptz not null default now(),
  detail  jsonb
)
