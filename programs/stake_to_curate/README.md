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

## Vault vs external DeFi

Reaction **stakes** lock **SOL in the program vault** (`vault` PDA). **`total_principal_locked`** tracks user principal owed from the vault. **Surplus** lamports (vault balance minus principal minus rent) may be moved to a configured **`yield_treasury`** via **`crank_sweep_yield_pool`** (permissionless). The repo’s **`immediate-yield-worker`** (see `app/scripts/immediate-yield-worker.ts` and `docs/vault-yield-pool-plan.md`) signs with that treasury keypair and runs JitoSOL → Kamino off-wallet.

## API (Phase 1 — implemented)

| Instruction | Role |
|-------------|------|
| `initialize_slot` | Authority + creator + platform pubkeys; creates **slot** PDA + **vault** PDA; initializes `total_principal_locked = 0`, `yield_treasury = default`. |
| `configure_yield_treasury` | Authority sets **yield_treasury** pubkey (rejects default). |
| `crank_sweep_yield_pool` | Permissionless: transfer up to `amount` from vault → `yield_treasury` if vault retains rent + `total_principal_locked`. |
| `register_scene` | **Contributor** signs and pays rent; registers a **scene** PDA under the slot (`scene_key`, initial rank) and sets **`reserved_by`** to the contributor. Slot authority does not sign. **Breaking:** older `Scene` account layouts on devnet are incompatible—increase `VITE_DEMO_SLOT_ID` or deploy a fresh program after upgrade. |
| `stake_scene_up` / `stake_scene_down` | Lock SOL in vault; update rank; increment **`total_principal_locked`** by `amount`. |
| `unstake_scene` | Return principal; decrement **`total_principal_locked`**; residual rank rules. |
| `reset_scene_rank` | Authority-only rank reset (no lamport movement). |
| `deposit_revenue` | *(Spec; not in slim demo `lib.rs`.)* **20%** creator, **10%** platform, **70%** curators. |
| `claim_curator` | *(Spec.)* Pay accrued rewards. |

**Not in Phase 1:** `sweep_stale` / 90-day dust — see [`docs/project-description.md`](../../docs/project-description.md).

**`deposit_revenue`:** the client must pass **every** position account for that version as **remaining accounts** (the demo app uses `getProgramAccounts` + `dataSize` **99**).
