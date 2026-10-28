-- Class attendance for our students, summarised from the LMS by `npm run db:sync-attendance`
-- (this term: from ATTENDANCE_FROM, default 1 July). Dates are LMS (India) dates.

-- One row per class session that marked any of our students.
create table att_sessions (
  id            integer primary key,
  lecture_date  date not null,
  start_time    text,
  section_id    integer,
  course_id     integer,
  subject       text,
  faculty_id    integer,
  faculty       text,
  marked        integer not null,
  present       integer not null
);
create index att_sessions_section_idx on att_sessions (section_id, lecture_date);
create index att_sessions_faculty_idx on att_sessions (faculty_id);

-- Per student per subject: sessions marked and attended.
create table att_student_subject (
  lms_user_id  integer not null,
  course_id    integer not null,
  subject      text,
  sessions     integer not null,
  present      integer not null,
  last_date    date,
  primary key (lms_user_id, course_id)
);

-- Per student per week (Monday): sessions marked and attended, for trends.
create table att_student_week (
  lms_user_id  integer not null,
  week         date not null,
  sessions     integer not null,
  present      integer not null,
  primary key (lms_user_id, week)
)
