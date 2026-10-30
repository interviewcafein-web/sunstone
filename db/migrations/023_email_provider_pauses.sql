-- Email providers that refused for a used-up quota (api/_email.ts): skipped until `until`,
-- when their quota is back, so emails go straight to the next provider meanwhile.
create table if not exists email_provider_pauses (
  provider  text primary key,                -- 'Resend', 'Brevo', 'Mailjet'
  until     timestamptz not null,
  reason    text,
  at        timestamptz not null default now()
);
