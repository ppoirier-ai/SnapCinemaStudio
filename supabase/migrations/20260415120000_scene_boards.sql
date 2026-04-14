-- Editorial scene board state (movies matrix). On-chain StakeToCurate holds ranks/stakes only.
-- Writes: service role via Vercel /api/scene-board (wallet signature). Reads: anon.

create table if not exists public.scene_boards (
  id uuid primary key default gen_random_uuid(),
  creator_wallet text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint scene_boards_creator_wallet_key unique (creator_wallet)
);

create index if not exists scene_boards_creator_wallet_idx
  on public.scene_boards (creator_wallet);

alter table public.scene_boards enable row level security;

-- World-readable: demo Watch viewers load the publisher wallet row without auth.
create policy "scene_boards_select_anon"
  on public.scene_boards
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete for anon; service role bypasses RLS.
