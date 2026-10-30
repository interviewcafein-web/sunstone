-- Ask Vertex (api/ask.ts): AI answers kept for reuse, and how many AI questions each person
-- asked per day (a fair share of the free AI allowance).

-- An AI answer for a prompt that will come again (pain point suggestions for the same data).
create table if not exists ai_answers (
  key         text primary key,        -- sha-256 of the prompt
  answer      text not null,
  model       text,
  created_at  timestamptz not null default now()
);

create table if not exists ai_usage (
  user_email  text not null,
  day         date not null,
  questions   integer not null default 0,
  primary key (user_email, day)
);
