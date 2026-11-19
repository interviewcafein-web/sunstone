-- Converge's PRIME Domain page (api/prime.ts): subject credits (the default planned hours),
-- whether each submission has been graded, HQ's own planned hours, and every student of the
-- school (PRIME opt-in or not) with their best offer, to compare placement outcomes.

-- The LMS subject's credits; planned hours default to 15 per credit.
alter table lms_courses add column if not exists credits integer;

-- The LMS grading status: submitted work may still be waiting for a trainer to grade it.
alter table lms_test_results add column if not exists graded boolean;

-- Planned hours set by HQ for a subject at a campus and batch, overriding the credit-based default.
create table if not exists prime_planned_hours (
  campus_id       integer not null,
  program         text not null,
  admission_year  integer not null,
  subject         text not null,
  hours           numeric(6, 1) not null,
  set_by          text,
  set_at          timestamptz not null default now(),
  primary key (campus_id, program, admission_year, subject)
);

-- Every student of the school at our campuses, PRIME opt-in or not, with their offers (no names
-- or contact details), copied nightly by scripts/sync-placements.ts.
create table if not exists placement_population (
  lms_user_id       integer primary key,
  campus_id         integer,
  program           text,
  admission_year    integer,
  opted_in          boolean not null,
  ft_offers         integer not null default 0,
  ft_best_lpa       numeric(7, 2),
  intern_offers     integer not null default 0,
  intern_best_stipend integer
);
