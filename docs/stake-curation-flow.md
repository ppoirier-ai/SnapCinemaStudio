# Stake-to-curate flow (Watch, vault, admins)

**Purpose:** Single reference for how **upstake**, **downstake**, and **unstake** work in SnapCinema Studio, what **admins** must do once, and what is **out of scope** on-chain. Update this file when behavior or copy changes.

**Related code (non-exhaustive):**

- Program: [`programs/stake_to_curate/src/lib.rs`](../programs/stake_to_curate/src/lib.rs)
- Program README: [`programs/stake_to_curate/README.md`](../programs/stake_to_curate/README.md)
- Product spec: [`docs/project-description.md`](./project-description.md)
- App client (instructions): [`app/src/stakeToCurate/client.ts`](../app/src/stakeToCurate/client.ts)
- React context (stakes, instant session, withdraw helpers): [`app/src/context/DemoSlotContext.tsx`](../app/src/context/DemoSlotContext.tsx)
- Watch UI: [`app/src/pages/WatchPage.tsx`](../app/src/pages/WatchPage.tsx)

---

## One-time setup (platform admin)

Before fans can stake on **Watch**, the **slot authority** wallet (see `VITE_STAKE_SLOT_AUTHORITY` in [`app/.env.example`](../app/.env.example)) should:

1. Point the app at the deployed StakeToCurate program (`VITE_STAKE_TO_CURATE_PROGRAM_ID`, RPC, cluster matching Phantom).
2. In **Studio** (platform owner wallet only), run **Initialize** once: creates the **slot** PDA and **vault** PDA that will hold all staked SOL for that demo slot.
3. **Scenes** on-chain: contributors **register** a cell when they add a scene slot or save a URL (wallet pays rent; `register_scene` sets `reserved_by`). Optional **Studio** batch registration remains for slot-authority maintenance only—not required for normal users. YouTube URLs are stored off-chain (Supabase when configured); after a URL is saved and the scene exists on-chain, the UI treats the link as **immutable** to prevent rank hijacking.

If the slot is missing or a clip is not registered, Watch shows hints and reactions may stay disabled.

---

## Upstake (e.g. thumbs up on Watch)

### UI

1. User opens **Watch**, selects a movie; the player focuses a **scene** (cell) with a valid on-chain row.
2. If **instant staking** is not active, the app may require **Enable Instant Staking** / session funding so later reactions can be one approval pattern.
3. **Thumbs up** calls `onStakeUp(sceneKeyHex, FAN_REACTION_STAKE_LAMPORTS)` in [`DemoSlotContext`](../app/src/context/DemoSlotContext.tsx).

### On-chain (`stake_scene_up`)

1. SOL transfers from the **user’s signer** (Phantom or **instant session** keypair) to the program **vault** PDA (`system_transfer`).
2. **Scene rank** increases by a delta derived from the stake amount (`rank_delta` in the program).
3. **Position** PDA records owner, **up** side, amounts, `entry_rank` snapshot, active state.

**Net:** SOL is locked in the **vault**; that scene’s rank goes **up** (bullish curation).

---

## Downstake (e.g. thumbs down or flag on Watch)

### UI

Same pattern as upstake, but `onStakeDown` builds **`stake_scene_down`**.

### On-chain (`stake_scene_down`)

1. Same SOL transfer: user → **vault**.
2. **Scene rank** decreases by `rank_delta`, subject to a **floor** so rank cannot violate `MIN_INITIAL_RANK` / down-stake rules.
3. Position must stay on the **same side**; mixing up and down on the same scene for the same user hits **SideMismatch**.

**Net:** SOL locked in the **vault**; rank goes **down** (bearish curation).

---

## Unstake

### UI

Unstake is invoked with a **scene key** from the stake/Scene tooling; the context resolves **which signer** owns the position (main wallet or **instant session** keypair) and sends `unstake_scene`.

### On-chain (`unstake_scene`)

1. Verifies **position owner** signer.
2. Transfers **principal** lamports **vault → owner** in **one** transaction (no built-in multi-day delay in this program).
3. Updates scene rank: removes active stake weight, applies **residual** rank adjustment (~1% min lamports scale per program logic), updates `active_stake`.
4. Clears the position (inactive, zero amount).

**Net:** User gets **principal back immediately**; scene keeps a small **residual** rank footprint per spec.

---

## Yield treasury and surplus sweep (automation)

- The **Slot** account tracks **`total_principal_locked`** (sum of active stake principal) and an optional **`yield_treasury`** pubkey.
- **`configure_yield_treasury`** (authority): set where **surplus** vault SOL may be sent. **Studio → Admin** includes **Set yield treasury to this wallet** once the on-chain program supports it.
- **`crank_sweep_yield_pool`** (permissionless): moves up to `amount` lamports **vault → yield_treasury** only while the vault still holds **rent + total_principal_locked**. After a **plain stake**, surplus is usually **zero** until there are **donations** to the vault or other inflows not counted as principal.
- **`immediate-yield-worker`** ([`app/scripts/immediate-yield-worker.ts`](../app/scripts/immediate-yield-worker.ts)): run on **mainnet** with **`TREASURY_KEYPAIR`** matching **`yield_treasury`**; it sweeps when possible and runs **`runTreasuryPoolCompound`** (JitoSOL → Kamino) with **no Phantom** — see [`docs/vault-yield-pool-plan.md`](./vault-yield-pool-plan.md).

## What admins do *not* do per stake

- Admins **do not** approve each user stake; users (or session wallets) sign their own instructions.
- **Principal** in the vault is tracked for sweep safety; moving surplus into DeFi uses **`crank_sweep_yield_pool`** + treasury automation, not the fan wallet. Optional **Studio → Admin** Kamino **withdraw** still operates on the **connected wallet** for manual exits. See [`programs/stake_to_curate/README.md`](../programs/stake_to_curate/README.md).

---

## Revenue and curator “yield” (spec vs demo UI)

- On-chain **`deposit_revenue`** / **`claim_curator`** implement the **70% curator tranche** and weighting described in [`docs/project-description.md`](./project-description.md).
- The demo app may still **defer** or stub deposit/claim UX; check [`DemoSlotContext`](../app/src/context/DemoSlotContext.tsx) for current `onDeposit` / `onClaim` behavior before assuming revenue is live end-to-end.

---

## Instant staking session (optional UX)

- Users can fund an **ephemeral keypair** for a time window so Watch reactions don’t require Phantom every tap.
- Stakes from that session use the **session keypair** as owner; **unstake** must use the **same** owner that holds the position.

---

## Changelog

| Date | Notes |
|------|--------|
| 2026-04-13 | Initial doc from implementation review (yield boost removed from Watch; admin Jito/Kamino panel on Studio). |
| 2026-04-14 | Added `total_principal_locked`, `configure_yield_treasury`, `crank_sweep_yield_pool`, and `immediate-yield-worker` automation. |
| 2026-04-17 | Batch `register_scene` documented under **Studio**; cell URLs edited on wallet menu **Scene**. Studio route gated to platform owner in the app UI. |
| 2026-04-18 | `register_scene` is contributor-paid with `reserved_by`; scene board persistence prefers **Supabase** when configured (no duplicate `localStorage` writes). |
