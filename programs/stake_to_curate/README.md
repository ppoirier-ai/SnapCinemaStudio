# StakeToCurate (Anchor)

On-chain **proof-of-curation** primitive for SnapCinema Studio. Full mechanics and Phase 1 vs Phase 2 scope: [`../../docs/project-description.md`](../../docs/project-description.md).

## Program ID

- **Localnet / devnet (scaffold):** `4azLw8hCLoPiED81CNGXx5tthAsJUxm64P6kEnbg74ye` (matches `declare_id!` and [`Anchor.toml`](../../Anchor.toml)).

## Build & deploy

1. Copy the committed dev keypair into Anchor’s deploy dir (ignored by git):

   ```bash
   mkdir -p ../../target/deploy
   cp keys/stake_to_curate-keypair.json ../../target/deploy/stake_to_curate-keypair.json
   ```

2. From the **repo root:** `anchor build` then `anchor deploy --provider.cluster devnet` (with Solana CLI configured).

3. Regenerate a fresh program id for a serious deployment: new keypair, update `declare_id!`, `[programs.*]` in `Anchor.toml`, and redeploy — do **not** reuse the scaffold keypair on mainnet.

## API (Phase 1 — implemented)

| Instruction | Role |
|-------------|------|
| `initialize_slot` | Authority + creator + platform pubkeys; creates **slot** PDA + **vault** PDA. |
| `register_version` | Authority adds a **version** under a slot (initial rank; v0 floored to ≥ 1_000_000). |
| `stake_up` / `stake_down` | Lock SOL in vault; bump **rank**; open position with `entry_rank` snapshot (same user/version is **one** side). |
| `unstake` | Return principal; remove active rank; add **~1%** min-1-lamport **residual** rank. |
| `deposit_revenue` | **20%** creator, **10%** platform, **70%** split across **remaining** `Position` accounts for that version (weights: spec delta × bonding × active/residual). |
| `claim_curator` | Pay `accrued_rewards` from vault to owner. |

**Not in Phase 1:** `sweep_stale` / 90-day dust — see [`docs/project-description.md`](../../docs/project-description.md).

**`deposit_revenue`:** the client must pass **every** position account for that version as **remaining accounts** (the demo app uses `getProgramAccounts` + `dataSize` **99**).
