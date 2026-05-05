# Security notes

This document summarizes threat assumptions and production configuration for SnapCinema Studio. It complements the implementation in [`app/api/`](../app/api/) and the StakeToCurate program under [`programs/stake_to_curate/`](../programs/stake_to_curate/).

## Web / APIs

- **CORS:** Set `API_CORS_ORIGINS` to a comma-separated list of allowed browser origins (e.g. `https://your-app.vercel.app,http://localhost:5173`). If unset, APIs send `Access-Control-Allow-Origin: *` (convenient for local dev, avoid in strict production).
- **Rate limiting:** Public signup routes (`/api/mailing-list` without `op: list`, `/api/snap-alpha-priority`) use optional Upstash: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without these, limits are not enforced at the edge—configure them before high-traffic launch.
- **Turnstile:** Set server `TURNSTILE_SECRET_KEY` and build-time `VITE_TURNSTILE_SITE_KEY` to require Cloudflare Turnstile on those signup routes.
- **Body size:** JSON bodies are capped (default 256 KiB, override with `API_MAX_JSON_BODY_BYTES`).
- **Scene board:** Prefer a dedicated `SCENE_BOARD_JWT_SECRET` instead of reusing `SUPABASE_JWT_SECRET` so JWT rotation stays isolated from Supabase Auth.
- **Platform owner:** Set `PLATFORM_OWNER_PUBKEY` (and `VITE_PLATFORM_OWNER_PUBKEY` for the client) in production; do not rely on the repository default pubkey for privileged flows.

## Client headers

[`app/vercel.json`](../app/vercel.json) sets CSP and related headers. If the wallet, RPC, Clarity, YouTube embeds, or Turnstile break after deploy, narrow errors in the browser console and widen only the required directives.

## Solana

- The scaffold devnet program keypair in the repo is for iteration only—see root README. **Never reuse it for mainnet or custody funds.**
- The immediate yield worker (`npm run immediate-yield-worker`) must use secrets stored in a KMS/HSM or CI vault, not committed key material.

## Smart contract

Permissionless flows such as `crank_sweep_yield_pool` depend on correct treasury configuration. Engage an auditor before meaningful mainnet TVL.
