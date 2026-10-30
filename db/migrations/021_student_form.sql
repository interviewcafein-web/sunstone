-- The unlisted student form (/coding-usernames): students give their coding usernames
-- themselves, matched on their email. Every lookup and save is kept here, for the per-IP
-- limits and so a change can be checked or undone (before / after hold the six usernames).
create table if not exists student_form_events (
  id          bigint generated always as identity primary key,
  kind        text not null,                -- 'lookup' or 'save'
  ip          text,
  email       text not null,
  student_id  bigint,                       -- null when the email matched no student
  before      jsonb,
  after       jsonb,
  at          timestamptz not null default now()
);

create index if not exists student_form_events_ip_idx on student_form_events (ip, at);
create index if not exists student_form_events_student_idx on student_form_events (student_id, at);
