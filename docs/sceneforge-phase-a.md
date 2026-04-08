# SnapCinema Studio — Phase A MVP (StakeToCurate + evolving stream demo)

**Canonical detail:** Full mechanics, formulas, and builder ordering live in [`project-description.md`](project-description.md). This file is the **Phase A / hackathon scope** summary aligned to that spec.

**Phase A** matches **Phase 1** in [`project-description.md`](project-description.md): the smallest **closed loop** that instances the protocol—**StakeToCurate** on Solana (**SOL** only) plus a **thin** live-stream-style demo where **scene versions** evolve with **curator stakes** and **revenue splits** are **on-chain**. **No** **90-day sweep** in program v1; that is **Phase 2**.

---

## Goal

Ship a **verifiable** path: **multiple versions per scene slot** → **stake_up / stake_down** → **rank-weighted visibility** → **`deposit_revenue`** → **creator + platform + curator** splits and **claims**, with a **~90s** judge-friendly demo.

---

## In scope (Phase A)

| Area | Scope |
|------|--------|
| **Primitive** | **StakeToCurate** in **`programs/stake_to_curate/`**: **scene slots**, **versions**, **`stake_up` / `stake_down`**, **unstake** + **residual rank** (or **Phase 1** simplified unstake per canonical spec), **rank-based** show weights, **`deposit_revenue`**, **20% / 10% / 70%** split, **bonding-curve** curator rewards, **claims**. **SOL only.** **90-day sweep** → **Phase 2**. |
| **Demo vertical** | **One** minimal web app: **linear live-stream movie** across slots; **weighted-random** version choice from **live ranks**; **fast** Up/Down stakes (preset SOL); **live rank** UI; **simulated** revenue to exercise **splits and claims**. |
| **Storage / media** | **Off-chain** or placeholder URLs for streams; **on-chain** holds **version ids**, **stakes**, **ranks**, **revenue accounting**—not full IPFS pipeline in the critical path. |

---

## Out of scope (defer to Phase B+ / Phase 2)

- **90-day** (or policy) **`sweep_stale`** and other **Phase 2** primitive hardening (see [`project-description.md`](project-description.md)).
- Full **SnapCinema** production pipeline (editing, export, asset product).
- **Viewer** yield-for-access (Kamino / Marginfi-style) as a **consumer** product.
- **Advertiser** verified views, **lawyer** workflows, **personalization** engine.
- **Production** liquid-staking integration (**document intent** only for hackathon).
- **Native protocol token** (none).

---

## StakeToCurate (normative summary)

- **Curation** replaces cheap likes: **SOL** behind **up** or **down** on a **version**.
- **Visibility:** \(P(v) = \text{rank}_v / \sum \text{ranks in slot}\); new versions **~bottom 20%** exposure; **stakes instantly re-rank**.
- **Revenue:** **`deposit_revenue(version, amount)`**; **20% creators / 10% platform / 70% curators**; curator share uses **entry_rank snapshot**, **favorable delta**, **bonding curve**, **active vs residual** multiplier—see [`project-description.md`](project-description.md).

**Legal / product:** Stake-on-content outcomes may resemble **prediction** or **wagering** in some jurisdictions; get **review** before mainnet ([`sceneforge-legal-checklist.md`](sceneforge-legal-checklist.md)).

---

## Success criteria (Phase A)

1. **Demo script:** Open stream → **stake up/down** on a version → see **rank / playback** change → trigger **revenue** → **claim** curator share (all **on devnet**, documented).
2. **Threat model** in README: trusted **stream host / CDN**, **off-chain** URLs; trustless **stakes, ranks, revenue split math, claims** (as implemented).
3. **README** links this doc + [`project-description.md`](project-description.md).

---

## Naming

**SnapCinema Studio** — long-term decentralized studio vision. **Phase A** — **StakeToCurate** + **evolving stream** hackathon slice.

---

## Hackathon A0 — scope cut for *high* win probability

One **polished** path **under ~90 seconds**, **no** optional features on the **critical path**.

| Include (A0) | Drop for A0 |
|----------------|-------------|
| **StakeToCurate** program: **stake_up / stake_down**, **unstake** + residual, **ranks**, **`deposit_revenue`**, **split + claim** path on **devnet** | Full **LST** yield routing, **mainnet** deployment |
| **Minimal** sequential **“live”** playback (even **mock** stream) with **weighted-random** version per **slot** from **on-chain ranks** | Full **IPFS**, **NFT** mints, **multi-film** library |
| **Preset** SOL amounts for **Up/Down** (**&lt;10 s** per action) | Custom amount UX, **quadratic** stakes, **many** concurrent slots in UI |
| **Simulated** or **one-button** revenue + **visible** curator **claim** | Real **payment** rails, **ads**, **personalization** |
| **One** React page + wallet: connect → watch → **stake** → see **ranks** → **revenue** → **claim** | Analytics, **mobile** apps, **social** graph |

**Why this wins:** Judges see **money + taste on-chain + visible outcome** in one story—not a deck-only roadmap.

**SnapCinema tool:** Optional later; **manual** version metadata is fine for the demo.
