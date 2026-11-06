-- The LMS's opportunity cohorts each student is in (Cohort A - Pinnacle, B - Zenith, C,
-- D - Functional, E - Super-100), copied nightly by scripts/sync-cohorts.ts. Converge 2026
-- shows Super 100 from it; Vertex may use the same.
create table if not exists student_cohorts (
  lms_user_id  integer not null,
  cohort_id    integer not null,
  cohort       text not null,
  added_at     timestamptz,
  primary key (lms_user_id, cohort_id)
);

create index if not exists student_cohorts_cohort_idx on student_cohorts (cohort_id);
