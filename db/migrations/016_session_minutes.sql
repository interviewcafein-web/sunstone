-- LMS class length and one attending student per session (for the student's batch), so PRIME
-- coding hours in the LMS can be set against the delivery tracker's hours per trainer.
alter table att_sessions add column if not exists minutes integer;
alter table att_sessions add column if not exists first_student integer;
