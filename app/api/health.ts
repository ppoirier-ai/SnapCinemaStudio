import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Minimal no-Supabase check so you can see whether serverless is healthy.
 * Open GET /api/health in the browser after deploy.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    res.status(405).end()
    return
  }
  res.status(200).json({
    ok: true,
    node: process.version,
    hasSupabaseUrl: Boolean(
      process.env.SUPABASE_URL?.trim() ||
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    ),
    hasServiceRole: Boolean(
      process.env.SUPABASE_SECRET_KEY?.trim() ||
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ),
    hasJwtOrSceneSecret: Boolean(
      process.env.SUPABASE_JWT_SECRET?.trim() ||
        process.env.SCENE_BOARD_JWT_SECRET?.trim(),
    ),
  })
}
