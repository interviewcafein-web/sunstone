-- Internal exams from the LMS (`npm run db:sync-exams`): exam events (Midterm 1-6,
-- End-term), each subject's exam within an event, and our students' marks. Mock PI / Mock GD
-- exams are scored on criteria, kept with the mark.

create table exm_examinations (
  id          integer primary key,
  title       text,
  exam_type   text,            -- midterm_1 ... midterm_6, endterm
  start_date  date,
  end_date    date,
  semester    integer
);

create table exm_exams (
  id              integer primary key,
  course_id       integer,
  subject         text,
  title           text,
  kind            text,        -- other (a subject exam), mock_pi, mock_gd
  exam_date       date,
  max_marks       numeric,
  grades_type     text,        -- numeric_grades, text_based_grades, percentile
  examination_id  integer
);
create index exm_exams_examination_idx on exm_exams (examination_id);

create table exm_marks (
  exam_id      integer not null,
  lms_user_id  integer not null,
  marks        numeric,
  grade_text   text,           -- e.g. "AB" when absent, or a text grade
  graded_at    timestamp,
  criteria     jsonb,          -- Mock PI / GD: [{ name, marks, max }]
  primary key (exam_id, lms_user_id)
);
create index exm_marks_user_idx on exm_marks (lms_user_id)
