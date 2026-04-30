-- Alpha priority ($SNAP) registrations: email + Solana mailbox. Writes: Vercel /api/snap-alpha-priority (service role). No direct anon access.

create table if not exists public.snap_alpha_priority_registrations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  wallet_address text not null,
  source text not null,
  created_at timestamptz not null default now(),
  constraint snap_alpha_priority_source_check check (source in ('landing', 'watch')),
  constraint snap_alpha_priority_email_len check (length(trim(email)) > 0),
  constraint snap_alpha_priority_wallet_len check (length(trim(wallet_address)) > 0)
);

create unique index if not exists snap_alpha_priority_wallet_address_key
  on public.snap_alpha_priority_registrations (wallet_address);

create index if not exists snap_alpha_priority_registrations_created_at_idx
  on public.snap_alpha_priority_registrations (created_at desc);

alter table public.snap_alpha_priority_registrations enable row level security;

-- No policies for anon/authenticated: only service role (API) reads/writes.
