# Devnet migration: per-scene StakeToCurate

## What changed

- **Program id** is now `UfaPFjHzepp91cEzmfoAd2b7bMVWoB37wuPRa8vy9Su` (see `programs/stake_to_curate/src/lib.rs` and `app/.env.example`).
- **On-chain layout**: global `Version` (v0/v1) accounts are replaced by **`Scene`** PDAs keyed by a 32-byte `scene_key` (SHA-256 of `movie_id \\0 column_id \\0 cell_id` in UTF-8), plus **`ScenePosition`** per `(scene, owner)`.
- **Instructions**: `register_scene`, `stake_scene_up` / `stake_scene_down`, `unstake_scene`, `reset_scene_rank`. **`deposit_revenue` / `claim_curator` are removed** in this MVP.
- **Watch**: playlist weights are **per time column only** from each playable cell’s on-chain rank (or cell fallback), not a global v0/v1 playback fork.

## What to do on devnet

1. Set `VITE_STAKE_TO_CURATE_PROGRAM_ID` in `app/.env` to the deployed program id if you deploy a different keypair. **Check the string carefully:** the scaffold id contains **`B37`** (letter B), not **`837`** (digits) — a typo points at the wrong program and yields `InstructionFallbackNotFound` (101).
2. Deploy: `anchor build` then `solana program deploy` with the program keypair that matches `declare_id!` (see project Solana deploy rules).
3. Connect the **slot authority** wallet and run **Studio → Admin → Setup demo (init slot only)** once.
4. Open **Scene** as the authority and ensure each playable cell has a URL saved so **`register_scene`** runs (automatic when authority edits the matrix).

### `InstructionFallbackNotFound` (101) on `configure_yield_treasury` or `crank_sweep_yield_pool`

That Anchor code means the **on-chain `.so` does not include that instruction** (discriminator not recognized). Fix: **redeploy** the latest build to devnet:

```bash
cd /path/to/SnapCinemaStudio
anchor build
solana program deploy target/deploy/stake_to_curate.so \
  --program-id programs/stake_to_curate/keys/stake_to_curate-keypair.json \
  --url https://api.devnet.solana.com
```

After upgrading the program, **Slot** account size changed (`total_principal_locked`, `yield_treasury`). Existing slot PDAs created with the **old** layout may fail other instructions. Bump **`VITE_DEMO_SLOT_ID`** to a fresh id (e.g. 3), restart Vite, and run **Setup demo** again so a new slot + vault are initialized under the new layout.

Old devnet `Version` / `Position` accounts from the previous program id are **not** migrated; abandon them or keep the old program id pointed at legacy UI in a separate branch.

## Tests

- Rust unit tests (including `scene_key_from_ids` sanity checks): `cargo test -p stake_to_curate --lib`
- Full `anchor test` with a local validator requires a successful SBF build so `target/deploy/stake_to_curate.so` exists (Solana platform tools installed). This repo’s `Anchor.toml` `[scripts] test` runs the Rust unit tests only.
