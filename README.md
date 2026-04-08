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

## Status

**Phase 1** scope (no **90-day sweep** in-program) is defined in [`docs/project-description.md`](docs/project-description.md). Scaffold is present; fill in instruction bodies and wire the client next.
