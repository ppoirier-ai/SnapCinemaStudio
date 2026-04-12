# StakeToCurate (Anchor)

On-chain **proof-of-curation** primitive for SnapCinema Studio. Full mechanics and Phase 1 vs Phase 2 scope: [`../../docs/project-description.md`](../../docs/project-description.md).

## Program ID

- **Scaffold (this repo):** `UfaPFjHzepp91cEzmfoAd2b7bMVWoB37wuPRa8vy9Su` — matches `declare_id!` in [`src/lib.rs`](./src/lib.rs), [`keys/stake_to_curate-keypair.json`](./keys/stake_to_curate-keypair.json), and [`Anchor.toml`](../../Anchor.toml).

## Build & deploy

1. From the **repo root:** `anchor build`.

2. Deploy to **devnet** with the CLI (recommended; matches `declare_id!`):

   ```bash
   solana program deploy target/deploy/stake_to_curate.so \
     --program-id programs/stake_to_curate/keys/stake_to_curate-keypair.json \
     --url https://api.devnet.solana.com
   ```

   Use a funded devnet wallet (`solana config set --url devnet`).

3. Point the app at that program: `VITE_STAKE_TO_CURATE_PROGRAM_ID` in `app/.env` (see `app/.env.example`).

4. For a **new** production id: generate a keypair, update `declare_id!`, `[programs.*]` in `Anchor.toml`, rebuild, deploy — do **not** reuse the scaffold keypair on mainnet.

## Web demo: shared slot (Watch)

The Vite app keys the demo slot by `(authority, slot_id)`. For **Watch**, set **`VITE_STAKE_SLOT_AUTHORITY`** in `app/.env` to the **base58 pubkey** of the wallet that will run **Studio → Admin → Initialize** once. Every viewer then uses that same slot for ranks and stakes while signing only as **position owner**. Omit the variable for local solo use (connected wallet is both authority and staker). See `app/.env.example`.

## API (Phase 1 — implemented)

| Instruction | Role |
|-------------|------|
| `initialize_slot` | Authority + creator + platform pubkeys; creates **slot** PDA + **vault** PDA. |
| `register_version` | Authority adds a **version** under a slot (initial rank; v0 floored to ≥ 1_000_000). |
| `stake_up` / `stake_down` | Lock SOL in vault; **stake_up** adds `amount` to **rank**, **stake_down** subtracts it (floored: v0 ≥ 1_000_000, v1 ≥ 1); open position with `entry_rank` snapshot (same user/version is **one** side). |
| `unstake` | Return principal; remove active rank; add **~1%** min-1-lamport **residual** rank. |
| `deposit_revenue` | **20%** creator, **10%** platform, **70%** split across **remaining** `Position` accounts for that version (weights: spec delta × bonding × active/residual). |
| `claim_curator` | Pay `accrued_rewards` from vault to owner. |

**Not in Phase 1:** `sweep_stale` / 90-day dust — see [`docs/project-description.md`](../../docs/project-description.md).

**`deposit_revenue`:** the client must pass **every** position account for that version as **remaining accounts** (the demo app uses `getProgramAccounts` + `dataSize` **99**).
