-- Converge's PRIME Domain page (api/prime.ts): hours taught and the faculty, typed in by HQ for a
-- subject at a campus and batch. Many PRIME domain classes are never put on the LMS timetable,
-- so the LMS has no hours or faculty for them; what HQ types here is shown instead.

create table if not exists prime_taught_hours (
  campus_id       integer not null,
  program         text not null,
  admission_year  integer not null,
  subject         text not null,
  -- Hours taught per section; null keeps the LMS hours.
  hours           numeric(6, 1),
  -- Faculty names as typed; null keeps the LMS faculty.
  trainers        text,
  set_by          text,
  set_at          timestamptz not null default now(),
  primary key (campus_id, program, admission_year, subject)
);
