# SnapCinema Studio

Decentralized direction for **evolving movies** and **stake-backed curation** on Solana.

## Spec

- **[`docs/project-description.md`](docs/project-description.md)** — canonical **StakeToCurate** primitive + **thin demo vertical** (problems, mechanics, revenue math, success criteria).
- **[`docs/sceneforge-phase-a.md`](docs/sceneforge-phase-a.md)** — Phase A / **Hackathon A0** scope summary.
- **[`docs/colosseum-hackathon-sceneforge.md`](docs/colosseum-hackathon-sceneforge.md)** — Colosseum Frontier alignment and demo script.
- **[`docs/copilot-hackathon-reassessment.md`](docs/copilot-hackathon-reassessment.md)** — Copilot-backed comparison: StakeToCurate vs prior plan (hackathon + accelerator).

## Repo layout

- **`programs/stake_to_curate/`** — **StakeToCurate** Anchor program (primitive).
- **`app/`** — Vite + React + TypeScript; consumes the program IDL / ID after `anchor build`.
- **[`Anchor.toml`](Anchor.toml)** — workspace; **localnet** and **devnet** program IDs.

**Flow:** `anchor build` → deploy to **devnet** → run **`app`** against that program ID (see [`docs/project-description.md`](docs/project-description.md) § Implementation order).

Before the first `anchor build`, copy the scaffold program keypair into Anchor’s deploy directory (see [`programs/stake_to_curate/README.md`](programs/stake_to_curate/README.md)). That keypair is **public** (devnet / local iteration only)—**do not** reuse it for mainnet or real funds.

## Phase 1 — test on devnet

1. **Tooling:** Rust **1.86+** (see [`rust-toolchain.toml`](rust-toolchain.toml); required for current **avm** / `cargo install` of Anchor tooling), [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools), [Anchor](https://www.anchor-lang.com/docs/installation) **0.31.x** (install with `avm install 0.31.1 && avm use 0.31.1` so the CLI matches [`programs/stake_to_curate/Cargo.toml`](programs/stake_to_curate/Cargo.toml)).
2. **Program keypair:** From repo root, `mkdir -p target/deploy && cp programs/stake_to_curate/keys/stake_to_curate-keypair.json target/deploy/stake_to_curate-keypair.json`.
3. **Build & deploy:** `anchor build` then `anchor deploy --provider.cluster devnet` (wallet needs devnet SOL). Program ID must match [`Anchor.toml`](Anchor.toml) / `declare_id!` or update both + app env.
4. **App:** `cd app && cp .env.example .env` — set `VITE_STAKE_TO_CURATE_PROGRAM_ID` if you deployed a different ID; optional `VITE_SOLANA_RPC` (defaults to public devnet). `npm install && npm run dev`. Use **Phantom** on **devnet**, fund the wallet, then use the UI: **Setup** → **stake** → **deposit** → **claim** → **Roll playback**.

After `anchor build`, you can refresh instruction discriminators for the hand-written client with `node app/scripts/print-anchor-discriminators.js` and compare to [`app/src/stakeToCurate/client.ts`](app/src/stakeToCurate/client.ts) (they must match the deployed program).

## Threat model (demo)

- **Trustless on-chain:** stakes, ranks, vault accounting, **20/10/70** splits, curator **accrual** and **claims** (as implemented in `stake_to_curate`).
- **Trusted / off-chain:** video URLs, “playback” sampling in the browser, RPC, and wallet UX. The app does not prove stream viewership on-chain.

## Status

**Phase 1** program logic and a **wallet-connected demo app** are implemented; run the steps above on **devnet** to validate end-to-end. Spec: [`docs/project-description.md`](docs/project-description.md).
