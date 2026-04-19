-- Waitlist / mailing list signups. Writes: Vercel /api/mailing-list (service role). No direct anon access.

create table if not exists public.mailing_list_signups (
  id uuid primary key default gen_random_uuid(),
  email text,
  telegram text,
  intent text not null,
  source text not null,
  created_at timestamptz not null default now(),
  constraint mailing_list_signups_intent_check check (intent in ('watch', 'contribute')),
  constraint mailing_list_signups_source_check check (source in ('landing', 'watch')),
  constraint mailing_list_signups_contact_check check (
    (email is not null and length(trim(email)) > 0)
    or (telegram is not null and length(trim(telegram)) > 0)
  )
);

create index if not exists mailing_list_signups_created_at_idx
  on public.mailing_list_signups (created_at desc);

alter table public.mailing_list_signups enable row level security;

-- No policies for anon/authenticated: only service role (API) reads/writes.
