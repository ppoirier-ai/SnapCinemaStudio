# SnapCinema Studio — web app

Vite + React front end for **StakeToCurate** on Solana, plus Vercel serverless routes under [`api/`](api/). The Anchor program and workspace docs live at the [repository root](../README.md).

## Quick start

```bash
cd app
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. Wallet flows default to **devnet** (fund the wallet from a faucet). Point `VITE_SCENE_BOARD_API_URL` at a deployed origin when you need cloud APIs locally (Vite does not run `/api/*`).

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b` + production bundle |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (crypto / API helpers) |
| `npm run preview` | Serve `dist/` |
| `npm run immediate-yield-worker` | Node worker for vault sweep + Kamino (mainnet; see `.env.example`) |

## Deploy (Vercel)

1. Connect the repo; set **Root Directory** to `app` (or run build from monorepo root with the same layout).
2. Apply Supabase migrations from [`../supabase/migrations/`](../supabase/migrations/).
3. Configure env vars from [`.env.example`](.env.example). Production should set **`API_CORS_ORIGINS`**, optional **Upstash** + **Turnstile**, **`PLATFORM_OWNER_PUBKEY`**, and a dedicated **`SCENE_BOARD_JWT_SECRET`** where possible (see [`../docs/security.md`](../docs/security.md)).

Security-related response headers are defined in [`vercel.json`](vercel.json).

## Architecture notes

- **Client-only “auth”:** Routes under `AuthedShell` require a connected wallet; there is no classic session cookie.
- **Scene board cloud sync:** [`api/scene-board-session.ts`](api/scene-board-session.ts) mints an HMAC-bound token after `signMessage`; [`api/scene-board.ts`](api/scene-board.ts) upserts JSON to Supabase using that bearer token.
