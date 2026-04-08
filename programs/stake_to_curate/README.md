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

## API (target)

Per [`docs/project-description.md`](../../docs/project-description.md): `stake_up`, `stake_down`, `unstake`, `deposit_revenue`, curator **claims**, rank updates — **no** `sweep_stale` in Phase 1.
