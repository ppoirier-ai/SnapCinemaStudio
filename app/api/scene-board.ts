import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { parseVercelJsonBody } from './lib/parseVercelJsonBody'
import {
  isCloudPayloadV1,
  verifyBoardJwt,
} from './lib/sceneBoardHmac'
import {
  getSceneBoardJwtSecret,
  getSupabaseServiceRoleKey,
  getSupabaseUrlForServer,
} from './lib/supabaseServerEnv'

/**
 * Persists scene board JSON to Supabase. Session minting is `scene-board-session.ts`
 * (separate function bundle, no `createClient` on the hot path for Watch).
 */
function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS')
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  try {
    if (req.method !== 'PUT') {
      res.setHeader('Allow', 'PUT, OPTIONS')
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabaseUrl = getSupabaseUrlForServer()
    const serviceKey = getSupabaseServiceRoleKey()
    const jwtSecret = getSceneBoardJwtSecret()

    if (!supabaseUrl || !serviceKey || !jwtSecret) {
      res.status(503).json({
        error:
          'Server missing Supabase URL, service key, or JWT secret (e.g. SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_JWT_SECRET, optional SCENE_BOARD_JWT_SECRET)',
      })
      return
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const auth = req.headers.authorization
    const bearer =
      typeof auth === 'string' && auth.startsWith('Bearer ')
        ? auth.slice(7).trim()
        : ''
    if (!bearer) {
      res.status(401).json({ error: 'Missing bearer token' })
      return
    }
    const session = verifyBoardJwt(bearer, jwtSecret)
    if (!session) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    const body = parseVercelJsonBody(req)
    const payload = body.payload
    if (!isCloudPayloadV1(payload)) {
      res.status(400).json({ error: 'Invalid payload' })
      return
    }

    const { error } = await supabase.from('scene_boards').upsert(
      {
        creator_wallet: session.wallet,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'creator_wallet' },
    )

    if (error) {
      console.error('[scene-board] upsert', error)
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[scene-board] unhandled', e)
    if (res.headersSent) return
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
