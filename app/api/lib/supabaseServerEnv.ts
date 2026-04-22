/**
 * Vercel + Supabase uses `SUPABASE_SECRET_KEY` (service role) and `SUPABASE_JWT_SECRET`.
 * This repo previously used `SUPABASE_SERVICE_ROLE_KEY` and optional `SCENE_BOARD_JWT_SECRET`.
 */

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v || undefined
}

export function getSupabaseUrlForServer(): string | undefined {
  return (
    trimEnv('SUPABASE_URL') ??
    trimEnv('NEXT_PUBLIC_SUPABASE_URL')
  )
}

/** Service role / secret key — use only on the server. */
export function getSupabaseServiceRoleKey(): string | undefined {
  return (
    trimEnv('SUPABASE_SERVICE_ROLE_KEY') ?? trimEnv('SUPABASE_SECRET_KEY')
  )
}

/**
 * HMAC secret for the scene board token in `api/scene-board-session` and
 * `api/scene-board`. Prefer
 * `SCENE_BOARD_JWT_SECRET`; else use Supabase’s project JWT secret (not the anon key).
 */
export function getSceneBoardJwtSecret(): string | undefined {
  return (
    trimEnv('SCENE_BOARD_JWT_SECRET') ?? trimEnv('SUPABASE_JWT_SECRET')
  )
}
