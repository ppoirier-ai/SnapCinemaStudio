# SnapCinema Studio

**SnapCinema Studio** is a decentralized movie studio on **Solana**: watch and contribute to evolving films, **earn** by staking your taste on scene versions, and see **stake-backed curation** rank what plays next—all backed by the **StakeToCurate** Anchor program. The public site frames it as *watch and contribute to the next big blockbuster*—join fans who create the story or simply watch to earn (current UI targets **Solana devnet**).

## Features

- **Paid to watch and stake** — Lock a small amount of SOL when you signal scenes; if your taste lines up with the crowd, you can earn curator rewards.
- **Contribute scenes** — Bring alternate cuts (for example from your favorite AI video tools); versions compete by on-chain rank.
- **Transparent splits** — Stakes, ranks, vault accounting, and **20 / 10 / 70** revenue math live on-chain (see the spec below); streaming URLs and browser playback remain trusted in the demo.

## Repository layout

| Path | Purpose |
|------|---------|
| [`programs/stake_to_curate/`](programs/stake_to_curate/) | **StakeToCurate** Anchor program (reusable primitive). |
| [`app/`](app/) | Vite + React + TypeScript front end; uses the program IDL / ID after `anchor build`. |
| [`Anchor.toml`](Anchor.toml) | Workspace config; program IDs for **localnet** and **devnet**. |

**Builder flow:** `anchor build` → deploy to **devnet** → run **`app`** against that program ID (see [Installation](#installation)).

Before the first `anchor build`, copy the scaffold program keypair into Anchor’s deploy directory (see [`programs/stake_to_curate/README.md`](programs/stake_to_curate/README.md)). That keypair is **public** (devnet / local iteration only)—**do not** reuse it for mainnet or real funds.

## Documentation

- **[`docs/project-description.md`](docs/project-description.md)** — Canonical **StakeToCurate** primitive + **thin demo vertical** (problems, mechanics, revenue math, success criteria).
- **[`docs/sceneforge-phase-a.md`](docs/sceneforge-phase-a.md)** — Phase A / **Hackathon A0** scope summary.
- **[`docs/colosseum-hackathon-sceneforge.md`](docs/colosseum-hackathon-sceneforge.md)** — Colosseum Frontier alignment and demo script.
- **[`docs/copilot-hackathon-reassessment.md`](docs/copilot-hackathon-reassessment.md)** — Copilot-backed comparison: StakeToCurate vs prior plan (hackathon + accelerator).

## Installation

End-to-end setup: install toolchains, build and deploy the program to **devnet**, then configure and run the web app. For **app-only** local UI against the default program ID, see [`app/README.md`](app/README.md) (skip deploy if you use the published program ID unchanged).

### Prerequisites

- **Rust** **1.86+** (see [`rust-toolchain.toml`](rust-toolchain.toml); required for current **avm** / `cargo install` of Anchor tooling).
- **[Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)** — install and point at devnet when deploying (`solana config set --url devnet`). Fund the deploy wallet from a devnet faucet.
- **[Anchor](https://www.anchor-lang.com/docs/installation)** **0.31.x** — e.g. `avm install 0.31.1 && avm use 0.31.1` so the CLI matches [`programs/stake_to_curate/Cargo.toml`](programs/stake_to_curate/Cargo.toml).
- **Node.js** (LTS) and **npm** — for the Vite app.

### 1. Prepare the program keypair

From the repository root (after cloning):

```bash
mkdir -p target/deploy
cp programs/stake_to_curate/keys/stake_to_curate-keypair.json target/deploy/stake_to_curate-keypair.json
```

### 2. Build and deploy to devnet

```bash
anchor build
```

Deploy so the **program ID** matches `declare_id!` in the program and [`Anchor.toml`](Anchor.toml). Either:

```bash
anchor deploy --provider.cluster devnet
```

or, explicitly:

```bash
solana program deploy target/deploy/stake_to_curate.so \
  --program-id programs/stake_to_curate/keys/stake_to_curate-keypair.json \
  --url https://api.devnet.solana.com
```

If you deploy a **different** program ID, update `declare_id!`, `[programs.*]` in `Anchor.toml`, **and** `VITE_STAKE_TO_CURATE_PROGRAM_ID` in the app env (see below).

### 3. Configure environment

```bash
cd app
cp .env.example .env
```

Edit `.env`:

- **`VITE_STAKE_TO_CURATE_PROGRAM_ID`** — set if your deployed ID differs from the scaffold.
- **`VITE_SOLANA_RPC`** — optional; defaults to public devnet RPC if unset.
- **`VITE_STAKE_SLOT_AUTHORITY`** — optional; base58 pubkey of the wallet that runs **Dashboard → Setup** once so **Watch** shares one demo slot ([`app/.env.example`](app/.env.example), [`programs/stake_to_curate/README.md`](programs/stake_to_curate/README.md)).

### 4. Install dependencies and run the app

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`). Use **Phantom** on **devnet**, fund the wallet, then: **Setup** → **stake** → **deposit** → **claim** → **Roll playback**.

### 5. Optional checks

After `anchor build`, you can refresh instruction discriminators for the hand-written client with `node app/scripts/print-anchor-discriminators.js` and compare to [`app/src/stakeToCurate/client.ts`](app/src/stakeToCurate/client.ts) (they must match the deployed program).

### Hosting the web app (production-shaped)

The Vite app can be deployed to Vercel and wired to Supabase / API routes; follow [`app/README.md`](app/README.md) (**Root Directory** `app`, env vars, migrations).

## Threat model (demo)

- **Trustless on-chain:** stakes, ranks, vault accounting, **20/10/70** splits, curator **accrual** and **claims** (as implemented in `stake_to_curate`).
- **Trusted / off-chain:** video URLs, “playback” sampling in the browser, RPC, and wallet UX. The app does not prove stream viewership on-chain.

## Status

**Phase 1** program logic and a **wallet-connected demo app** are implemented; follow [Installation](#installation) on **devnet** to validate end-to-end. Spec: [`docs/project-description.md`](docs/project-description.md).

## Production checklist

- **[`docs/security.md`](docs/security.md)** — CORS allowlist, optional Upstash rate limits, Turnstile, JWT and platform-owner secrets, Solana key hygiene.
- **CI:** [`.github/workflows/app-ci.yml`](.github/workflows/app-ci.yml) (lint, tests, build); [`.github/workflows/gitleaks.yml`](.github/workflows/gitleaks.yml) with [`.gitleaks.toml`](.gitleaks.toml) excluding only the documented devnet scaffold keypair.
- **Mainnet:** use a fresh deploy authority keypair, deliberate treasury configuration, and third-party program audit before material TVL.

## License

This project is licensed under the MIT License — see [`LICENSE`](LICENSE).
