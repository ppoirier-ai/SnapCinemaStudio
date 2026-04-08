# SnapCinema Studio — project description (StakeToCurate + demo vertical)

**Canonical spec:** This file is the **source of truth** for the refined **primitive** and **thin demo** before and during implementation. Older notes elsewhere may use prior “binary judge + bounty” language—treat those as **superseded** unless explicitly marked historical.

---

## Phase 1 vs Phase 2

**Phase 1 (first ship — hackathon / devnet demo)** is the **minimum credible loop**: **StakeToCurate** in [`programs/stake_to_curate/`](../programs/stake_to_curate/) plus a **thin** demo in [`app/`](../app/). On-chain: **slots / versions**, **`stake_up` / `stake_down`**, **`unstake`**, **rank** updates, **`deposit_revenue`**, **20 / 10 / 70** split, **curator** math and **claims**. **No** time-based **`sweep_stale`** (no **90-day** unclaimed sweep in the program). The demo can stay small: **1–2** slots, **2–3** versions total.

**Residual rank on unstake** (see below) is the **full** design target; if it risks the deadline, **Phase 1 fallback** is: return principal and **remove** active stake weight from rank **without** a permanent **1%** residual footprint—ship **full** residual semantics in **Phase 2**.

**Phase 2 (backlog)** includes: **90-day** (or policy-based) **sweep** of stale curator rewards; **full** residual permanence if simplified in P1; richer **version** lifecycle; optional **standalone** OSS repo / versioned releases for the primitive; real **streaming** infra and any **second** program for rights/metadata when legal/product ready.

---

## Vision (product)

**SnapCinema Studio** is a decentralized, blockchain-powered direction for **evolving movies** shown via **live streaming**: the “film” is **not static**—**scenes change in real time** based on **curator stakes**. Re-watching can surface **different versions** of a scene, so repeat viewing stays fresh. **Multiple versions** of each scene can exist at once, weighted by **audience preference** encoded on-chain. **Revenue** from streamed content is **split on-chain** between **creators** and **curators** according to published rules.

**Hackathon slice:** We do **not** ship the full vision in v1—we ship the **StakeToCurate** primitive plus a **single polished vertical** that proves the loop (see **Layer B**).

---

## Problems

### 1. Static canon vs. fan agency

Fans often want **different scenes or endings** than what shipped; with **generative tools** they can produce **alternatives**. Centralized distribution rarely gives those alternatives **fair, manipulation-resistant** preference signals tied to **real economic weight** or **revenue**.

### 2. Cheap engagement

**Likes, comments, and views** are easy to farm, distorting **traction** for **creators, advertisers, and investors**.

### 3. Honest scope

- We **do not** solve all **IP / licensing** or **full production pipeline** in v1.
- We **do not** claim to eliminate **all** bots—only that **on-chain SOL** behind **curation** is **costly** and **verifiable** relative to **free** reactions.
- **Off-chain** stream delivery and **view counts** remain **trusted** in the thin demo unless you add separate infra.

---

## Proposed solution (two layers)

### Layer A — **StakeToCurate** (reusable Anchor primitive)

A **small, generic** Solana program: **proof-of-curation**—**stake-backed up/down** on **content versions**, **rank-driven visibility**, and **on-chain revenue sharing**. **No movie-specific** logic inside the core (slots/versions are generic identifiers the app interprets).

#### Content model

- **Scene slot:** A logical bucket (e.g. “minute 12”) that can hold many **versions** of that scene.
- **Version:** A competing cut of that slot; each version has its own **rank** and **stake state**.

#### Core instructions

| Instruction | Purpose |
|-------------|---------|
| **`stake_up`** | Lock **SOL** on a **specific version** (bullish curation). |
| **`stake_down`** | Lock **SOL** on a **specific version** (bearish curation). |

Both lock SOL against the chosen version; mechanics below define **rank**, **visibility**, and **payouts**.

#### Visibility (rank-based selection)

- New versions **start in the bottom ~20%** of rank exposure (test-audience style).
- **Probability** a viewer is shown a given version in a slot:

  \[
  P(\text{version}) = \frac{\text{its\_rank}}{\sum \text{ranks in slot}}
  \]

  (Normalized over all versions in the slot—smooth, long-tail friendly.)

- **Every stake** updates ranks so the distribution **reacts immediately**.

#### Unstake / residual

- Users may **unstake** anytime and **reallocate** SOL.
- On unstake, the version keeps a **permanent 1% residual** contribution to **rank**.
- The unstaker’s **personal payout multiplier** drops to **1%** of the **active** level (residual curator state).

#### Revenue

- **`deposit_revenue(version, amount)`** — anyone can add **SOL** (simulated subscriptions, sponsors, tips in the demo).
- **Split of incoming revenue:**
  - **20%** — scene **creator(s)**
  - **10%** — **platform** fee
  - **70%** — **curators** (distributed per payout math below)

#### Payout model (curator rewards)

- On stake, snapshot the version’s **`entry_rank`**.
- **Favorable rank delta:**
  - **Upstaker:** \(\max(0,\ \text{current\_rank} - \text{entry\_rank})\)
  - **Downstaker:** \(\max(0,\ \text{entry\_rank} - \text{current\_rank})\)
- **Bonding curve multiplier** (rewards early / long-tail stake on a version):

  \[
  \text{multiplier} = 1 + \frac{0.8}{1 + \text{total\_active\_stake\_on\_version} / 50}
  \]

- **Effective weight:** \(\text{favorable\_delta} \times \text{multiplier} \times (1\ \text{if active curator else}\ 0.01)\)
- **Normalization:** Curator weights are **normalized** so the **70%** curator tranche is **fully allocated** proportionally.
- **Claims:** Curators can **claim anytime**; the UI shows **live** accrued rewards.
- **Dust / sweep (Phase 2 only):** **Unclaimed** curator rewards **older than 90 days** may be **swept** back into the **pools** (instruction + policy in program README when shipped). **Not** part of **Phase 1**—omit **`sweep_stale`** from the first program cut.

#### Asset

- **SOL only** for stakes and revenue in v1 (**no USDC**).

#### Reuse

Same primitive can power **contests, DAOs, grants, feeds**—any product that needs **stake-backed curation** with **rank-weighted surfacing** and **shared revenue**.

---

### Layer B — Thin demo vertical: **evolving live-stream movie**

A **minimal web app** that **composes** StakeToCurate:

| Element | Behavior |
|---------|----------|
| **Playback** | A **linear “live” movie** built from **sequential scene slots**; which **version** plays per slot is chosen **on load / tick** using the primitive’s **rank-weighted** probabilities—so **different users see different paths**, and **re-watches** can differ. |
| **Curation UX** | **Fast “enhanced Like”** controls: **Up** / **Down** with **small preset SOL** amounts—target **&lt;10 seconds** per action, feels like Like/Dislike. |
| **Feedback** | **Live rank** (and optional weight previews) visible in the UI. |
| **Revenue demo** | **Simulated** or **one-click** `deposit_revenue` so judges see **curator earnings** and **splits** (20 / 10 / 70). |
| **Duration** | A **judge or new user** can complete **stake → see rank move → see revenue effect** in **~90 seconds**. |

The demo **creates** slots and versions, routes **all** stakes through **StakeToCurate**, **samples** versions for playback from **live ranks**, and uses the program’s **revenue + claim** rules.

---

## How the layers connect

| Layer | Role |
|-------|------|
| **StakeToCurate** | Truth for **stakes, ranks, revenue accounting, claims**. |
| **Demo app** | **Streaming UX**, **preset amounts**, **which URL/hash** maps to which **version** account, and **orchestration** only. |

**Narrative merge:** **Today** — proof-of-curation for **evolving, fan-influenced cinema**. **Tomorrow** — same **primitive** for any **stake-backed curation** surface.

---

## Strict out-of-scope (first delivery)

- Full **SnapCinema** pipeline (editing, export, long-term storage product).
- **Viewer** yield-for-streaming, **advertiser** verified metrics, **personalization** engine.
- **Production** liquid-staking integration (**document intent only**; no mainnet LST requirement for hackathon).
- Claiming **all** bot or **fake view** problems are solved.

---

## Success criteria

1. **README** clearly separates **StakeToCurate** (reusable) from the **demo vertical**; includes a **threat model** (trusted vs trustless—e.g. stream CDN, vs on-chain stakes and splits).
2. **Devnet** demo reproducible from documented steps (**Anchor + TS client** best practice).
3. **Video (2–3 min):** **problem** → **primitive** → **live evolving movie + quick stake up/down + revenue/claim path**.

**Strategic reassessment (hackathon + accelerator):** Colosseum Copilot–backed comparison of this spec vs the **prior** binary-judge/bounty slice—corpus overlap, win probability, VC narrative—is in [`copilot-hackathon-reassessment.md`](copilot-hackathon-reassessment.md). Re-run Copilot searches periodically as the Frontier cohort is indexed.

---

## Implementation order (for builders)

**Monorepo layout:** Root **`Anchor.toml`**, **`programs/stake_to_curate/`** (primitive), **`app/`** (Vite/React + IDL-based client). One **clone**, **`anchor build`**, deploy to **devnet**, point **`app`** at the program ID.

### Phase 1

1. **Anchor program** `stake_to_curate`: accounts, `stake_up` / `stake_down`, `unstake`, rank updates, `deposit_revenue`, curator math, **claims**. **No** 90-day sweep.
2. **TypeScript client** (from IDL) + **React** in `app/`: evolving stream + fast stakes + simulated revenue.
3. Polish **Solscan**-legible flows and **submission** assets.

### Phase 2

- Add **sweep** policy + instruction; harden **residual** edge cases if P1 used the simplified fallback.

Deliver the **Phase 1** loop first; defer **Strict out-of-scope** and **Phase 2** items to roadmap slides until scheduled.

---

## Appendix — copy-paste instructions for AI / Cursor

Use this block as **implementation briefing** (kept in sync with the sections above):

```text
Phase 1: Build SnapCinema Studio in a monorepo — programs/stake_to_curate (Anchor) + app (Vite/React, IDL client). StakeToCurate: stake_up / stake_down lock SOL per scene version; rank-based visibility P(v) = rank_v / sum(ranks in slot); new versions ~bottom 20% exposure; unstake (full residual target, or P1 fallback: remove weight without permanent residual); deposit_revenue; split 20/10/70; curator rewards from favorable delta × bonding curve × active/residual multiplier, normalized over 70%; claims anytime. NO 90-day sweep in P1. SOL only.

Thin demo: linear “live” movie, sequential slots, weighted-random version from on-chain ranks; Up/Down <10s; live ranks; simulated revenue; ~90s judge path.

Phase 2: sweep_stale / 90-day dust policy; full residual if simplified in P1. See docs/project-description.md. Out of scope: full pipeline, viewer yield streaming, ads, production LST, bot guarantees.
```
