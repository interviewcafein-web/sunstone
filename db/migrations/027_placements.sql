-- Job offers (selections), full-time and internships, for our students, copied nightly from the LMS by
-- scripts/sync-placements.ts. Only what the Placements page needs: no offer letters or
-- personal details. Amounts are in lakhs per annum (LPA), worked out as the placement team's
-- own report does: the offer's fixed pay (or the job's listed CTC when the offer has none)
-- plus variable pay.
create table if not exists placements (
  lms_user_id     integer not null,
  opportunity_id  integer not null,
  company         text,
  designation     text,
  -- Full-time as the placement team counts it (a full-time role, or flagged full-time);
  -- otherwise an internship or training. role_type is the LMS's own label.
  full_time       boolean not null,
  role_type       text,
  -- The job's role category in the LMS: Sales, IT, Finance, HR & Recruitment, Operations...
  category        text,
  fixed_lpa       numeric(7, 2),
  variable_lpa    numeric(7, 2),
  total_lpa       numeric(7, 2),
  -- Internships: the monthly stipend (rupees) and length in months. Their CTC is the pay
  -- on conversion to full-time.
  stipend         integer,
  months          smallint,
  selected_on     date,
  -- LMS joining status: 1 joined and working, 2 joined then left, 3 joining awaited,
  -- 4 not joining (another offer), 5 refused, 6 documents not shared, 7 terminated,
  -- 8 offer denied by the company, 9 and 10 denied by the student (JD/CTC or work mismatch).
  joining_status  smallint,
  joining_on      date,
  -- Withdrawn later (revoked, terminated, resigned...): still counted as a selection, as the
  -- placement team counts it, with the LMS's reason.
  withdrawn       boolean not null default false,
  withdrawn_reason text,
  -- The campus placement officer (CRC) who handled the job.
  crc             text,
  primary key (lms_user_id, opportunity_id)
);

create index if not exists placements_selected_idx on placements (selected_on);
