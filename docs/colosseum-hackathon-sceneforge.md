# Colosseum Frontier / hackathon — SnapCinema Studio alignment

This doc ties **hackathon execution** to **Phase A** ([`sceneforge-phase-a.md`](sceneforge-phase-a.md)) and the **canonical spec** ([`project-description.md`](project-description.md)).

**Ship target:** **StakeToCurate** (reusable **proof-of-curation** primitive) + **thin evolving live-stream demo**—not the full long-term studio vision unless it fits **A0** below.

---

## Build target (what judges can click)

| Layer | Hackathon deliverable |
|-------|------------------------|
| **Programs** | **StakeToCurate** in **`programs/stake_to_curate/`**: **scene slots / versions**, **`stake_up` / `stake_down`**, **unstake** + **residual rank** (or **Phase 1** simplified unstake), **rank-weighted** selection math, **`deposit_revenue`**, **20/10/70** split, **curator rewards** (delta × bonding curve × active/residual), **claims**. **SOL only.** **No** **90-day sweep** in **Phase 1** (deferred to **Phase 2**). |
| **Frontend** | **Minimal** React + Solana Wallet Adapter: **linear stream** (or mock) across **slots**; **version** picked from **live ranks**; **fast** Up/Down stakes; **rank** display; **simulated revenue** + **claim** demo. |
| **Network** | **Devnet**; document **mainnet** gaps and **legal** cautions. |

---

## Strong demo script (~90 seconds — A0)

Goal: **problem → primitive → feel** in one recording.

1. **Host:** Open the **evolving movie**—show that **playback** can differ (or re-roll) because **version choice** is **rank-weighted**.
2. **Viewer / curator:** Tap **Up** or **Down** with a **preset SOL** stake on the **current scene version**—**&lt;10 seconds**.
3. **Show:** **Ranks** update **live** after the tx; optionally **re-sample** next segment to show **different** version.
4. **Revenue:** Trigger **`deposit_revenue`** (simulated subscription/sponsor) — show **20 / 10 / 70** behavior in UI or Solscan notes.
5. **Claim:** Curator hits **claim** and **SOL** moves per program rules; show **signature(s)**.

**Recording tip:** Split screen: **your UI** + **Solscan** (stake accounts / program calls). Name **StakeToCurate** in the **first 30 seconds**.

**If time runs short:** Drop **real** streaming; keep **mock** video + **real** **stake_up/down + rank + claim** path.

---

## Deck / narrative rules

| Rule | Rationale |
|------|-----------|
| **StakeToCurate** and **reusable primitive** in **slide 1–2**. | Judges see **infra**, not only a film app. |
| **Evolving movie** demo is **proof**, not the **entire** product roadmap. | Avoid story-deck trap. |
| **Roadmap** slide labels **future** (full pipeline, ads, yield-for-viewer, etc.). | Credibility. |

---

## What not to claim in the hackathon build

- **No** “we shipped **production** liquid staking” unless code exists.
- **No** “we eliminated **all** bots / fake **views**”—only **on-chain curation stake** is in scope.
- **No** “full **SnapCinema** editor + storage” unless implemented.

---

## Relation to other Colosseum ideas

See [`colosseum-hackathon-brief.md`](colosseum-hackathon-brief.md) if present for other tracks. This submission is **StakeToCurate + evolving stream** per [`project-description.md`](project-description.md).

---

## Checklist before submit

- [ ] Demo video matches **A0** flows only.
- [ ] README + [`project-description.md`](project-description.md) + **threat model**.
- [ ] Deck separates **shipped primitive + demo** vs **roadmap**.
- [ ] Mainnet / real money: [`sceneforge-legal-checklist.md`](sceneforge-legal-checklist.md).
