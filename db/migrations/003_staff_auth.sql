-- Staff who may sign in with Google or an emailed code (passwordless). Password accounts
-- still live in the AUTH_USERS environment variable. Manage with `npm run staff`.

create table staff (
  email          text primary key check (email = lower(email)),
  name           text,
  active         boolean not null default true,
  added_at       timestamptz not null default now(),
  last_login_at  timestamptz
);

-- One-time sign-in codes sent by email. Only an HMAC of the code is stored.
create table login_codes (
  id          bigint generated always as identity primary key,
  email       text not null,
  code_hash   text not null,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index login_codes_email_idx on login_codes (email, created_at desc);
