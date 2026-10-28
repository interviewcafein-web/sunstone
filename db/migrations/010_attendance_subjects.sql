-- Most LMS sessions name their subject only in the event title, so attendance per student is
-- kept per subject name; sessions get the campus of the students marked in them.
drop table att_student_subject;
create table att_student_subject (
  lms_user_id  integer not null,
  subject      text not null,
  course_id    integer,
  sessions     integer not null,
  present      integer not null,
  last_date    date,
  primary key (lms_user_id, subject)
);
alter table att_sessions add column campus_id integer;
create index att_sessions_campus_idx on att_sessions (campus_id, lecture_date)
