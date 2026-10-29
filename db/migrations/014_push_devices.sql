-- Phones running the Vertex app, for push notifications (Expo push tokens). One row per
-- device; a token moves to whoever signed in on that phone last.
create table if not exists push_devices (
  token       text primary key,
  email       text not null,
  platform    text,
  updated_at  timestamptz not null default now(),
  disabled    boolean not null default false
);

create index if not exists push_devices_email_idx on push_devices (email) where not disabled;
