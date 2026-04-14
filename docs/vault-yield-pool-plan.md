# Vault yield pool — implementation plan (immediate, no human signer)

**Status:** **Implemented** in `programs/stake_to_curate`, `app/src/stakeToCurate/client.ts`, `app/src/yield/yieldStake.ts` (`runTreasuryPoolCompound`), and `app/scripts/immediate-yield-worker.ts`.

## Locked decisions

1. **Immediate mode:** After each user stake (and on a tight poll), an **automated worker** attempts `crank_sweep_yield_pool` and then **JitoSOL → Kamino** using a **treasury keypair** loaded from the environment (no Phantom, no manual approval per step).
2. **No human in the loop** for pool operations: signing is done only by **software** (keeper keypair). Users still sign their own **stake/unstake** with Phantom or the instant-session keypair.
3. **Custody:** Surplus SOL is swept to `yield_treasury` (configured on-chain). Kamino/JitoSOL positions are held by **that same treasury keypair** off the hot path of fan wallets.

## On-chain (`programs/stake_to_curate`)

Add to `Slot`:

- `total_principal_locked: u64` — incremented on `stake_scene_up/down`, decremented on `unstake_scene` (must match sum of active position principal for the slot).
- `yield_treasury: Pubkey` — default `Pubkey::default()` until configured.

Instructions:

- `configure_yield_treasury(treasury: Pubkey)` — **slot authority** only; rejects default pubkey.
- `crank_sweep_yield_pool(amount: u64)` — **permissionless**; fee payer is typically the worker. Enforces  
  `amount <= vault_lamports - total_principal_locked - rent_exempt_minimum(vault)` and `yield_treasury` configured; transfers vault → `yield_treasury`.

Account changes:

- `PlaceStakeScene` and `UnstakeSceneAccounts`: `slot` must be **`mut`** and update `total_principal_locked`.

Errors: `TreasuryNotConfigured`, `InsufficientSweepable`, `WrongTreasury`.

**Important:** Right after a **normal stake**, vault lamports increase **in lockstep** with `total_principal_locked`, so **sweepable is usually 0**. Surplus appears from **donations** to the vault PDA, **revenue** not tracked as principal, or a future **v2** instruction that routes part of stake without counting as unlocked principal. The worker still runs **immediately** and compounds **treasury SOL** (from any prior sweep) into Kamino.

## TypeScript client (`app/src/stakeToCurate/client.ts`)

- After `anchor build`, refresh Anchor instruction **discriminators** for new instructions.
- `ixStakeSceneUp` / `ixStakeSceneDown` / `ixUnstakeScene`: mark **slot** writable in the account metas.
- Add `ixConfigureYieldTreasury`, `ixCrankSweepYieldPool`.

## Yield pipeline (`app/src/yield/`)

- Extract **`runTreasuryPoolCompound`** (or parameterize existing flow): **JitoSOL mint + Kamino deposit** **without** appending a StakeToCurate stake instruction (pool yield is separate from user stake ix).
- Reuse `runYieldBoostWithdrawAll` for admin/ops exit paths; worker does not need withdraw in the hot loop.

## Worker (new, e.g. `workers/immediate-yield/` or `app/scripts/`)

Environment (example):

- `SOLANA_RPC`
- `TREASURY_KEYPAIR` (path to json) — **same pubkey** as `configure_yield_treasury`
- `STAKE_SLOT_AUTHORITY`, `DEMO_SLOT_ID` — to derive `slot` PDA
- `VITE_STAKE_TO_CURATE_PROGRAM_ID` / program id
- Kamino strategy id (same as app env)

Loop:

1. Subscribe to program logs or poll slot/vault balances.
2. On activity or interval (e.g. 2s): compute max sweep; if `> 0`, send `crank_sweep_yield_pool`.
3. Call `runTreasuryPoolCompound` with treasury balance (respect reserve for fees).

Run under **systemd**, **Docker**, or CI — **never** embed the treasury secret in the Vite client bundle.

## Docs to update after code lands

- [`docs/stake-curation-flow.md`](./stake-curation-flow.md) — yield treasury, worker, sweep semantics.
- [`programs/stake_to_curate/README.md`](../programs/stake_to_curate/README.md) — new instructions.

## Changelog

| Date | Notes |
|------|--------|
| 2026-04-14 | Implemented: on-chain sweep + treasury compound + worker; redeploy program for existing clusters (Slot account layout grew). |
