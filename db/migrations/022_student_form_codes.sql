-- Emailed codes for the student form (/coding-usernames): a student proves the email is
-- theirs before they see or change their usernames. Stored only as an HMAC; 10 minutes,
-- 5 wrong tries. Separate from staff sign-in codes (login_codes).
create table if not exists student_form_codes (
  id          bigint generated always as identity primary key,
  email       text not null,
  code_hash   text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists student_form_codes_email_idx on student_form_codes (email, created_at);
