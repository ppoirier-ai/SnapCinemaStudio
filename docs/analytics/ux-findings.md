# UX findings (Clarity + product)

Curated notes for planning UI work and for coding agents. **Microsoft Clarity** remains the source of truth for heatmaps, session recordings, and rage/dead clicks; refresh this file after you review the [Clarity dashboard](https://clarity.microsoft.com/).

## App instrumentation (reference)

- **Tags:** `route` (pathname), `route_name` (`landing` | `watch` | `dashboard` | `studio` | `contribute` | `account` | `other`), `wallet_connected` (`true` / `false`).
- **Events:** `wallet_connected` (once per browser session when a wallet connects); `first_route_watch` | `first_route_dashboard` | `first_route_contribute` | `first_route_account` (once per tab session on first visit to that area).

Enable Clarity locally or in production by setting `VITE_CLARITY_PROJECT_ID` at **build time** (e.g. Vercel project environment variables).

**Smoke test (after setting the project id and deploying or running `npm run dev`):**

1. Open the site; in DevTools → Network, confirm requests to `clarity.ms` / Clarity tag script.
2. In Clarity → Recordings, confirm new sessions appear within a few minutes.
3. Navigate between routes and connect a wallet; filter recordings by custom tag `route_name` or event `wallet_connected`.

---

## Report template (fill when updating)

**Review period:** <!-- e.g. 2026-04-01 – 2026-04-14 -->

**Top friction signals (from Clarity)**

- <!-- e.g. high rage clicks on Connect wallet; dead clicks on CTA -->
-

**Segments checked**

- <!-- e.g. filtered by `route_name` = watch, custom event `wallet_connected` -->
-

**Hypotheses**

1. <!-- -->
2. <!-- -->
3. <!-- -->

**Proposed engineering tasks**

- [ ] <!-- -->
- [ ] <!-- -->

**Out of scope / follow-ups**

- <!-- e.g. consent banner before Clarity if EU traffic -->

---

_Last updated: <!-- date -->_
