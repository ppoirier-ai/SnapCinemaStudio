/**
 * Liveness probe for serverless (`GET /api/health`). Does not touch Supabase; JSON flags only whether env placeholders exist — never returns secret values.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyApiCors, isCorsOriginAllowed } from './lib/cors.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  applyApiCors(req, res, 'GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    if (!isCorsOriginAllowed(req)) {
      res.status(403).end()
      return
    }
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
