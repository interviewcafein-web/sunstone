-- Where tests sit in a PRIME subject, and tests not released yet (see scripts/sync-assessments.ts).
--   subject (lms_courses) > module (lms_modules) > sub-folder (lms_lectures) > test
-- A test placed on the subject itself (e.g. "AMCAT Mock Test 2") has no module or lecture.

create table lms_lectures (
  id         integer primary key,
  course_id  integer not null,
  module_id  integer,
  title      text not null,
  position   integer
);
create index lms_lectures_module_idx on lms_lectures (module_id);

-- Every test placed in a subject, released or not.
create table lms_test_placements (
  test_id     integer not null,
  course_id   integer not null,
  module_id   integer,
  lecture_id  integer,
  primary key (test_id, course_id)
);
create index lms_test_placements_course_idx on lms_test_placements (course_id);

-- Which sections take which subject (so a campus sees tests not released to it yet).
create table lms_course_sections (
  course_id   integer not null,
  section_id  integer not null,
  primary key (course_id, section_id)
);
create index lms_course_sections_section_idx on lms_course_sections (section_id);

-- Releases now include future (scheduled) ones; visible = shown to students in the LMS.
alter table lms_test_releases add column visible boolean not null default true
