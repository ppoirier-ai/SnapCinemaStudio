/**
 * Persists scene board JSON to Supabase after bearer verification (`scene-board-session.ts` mints tokens).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GENERIC_INTERNAL_ERROR, logServerError } from './lib/apiErrors.js'
import { applyApiCors, isCorsOriginAllowed } from './lib/cors.js'
import { parseVercelJsonBody } from './lib/parseVercelJsonBody.js'
import { PayloadTooLargeError } from './lib/requestLimits.js'
import {
  isCloudPayloadV1,
  verifyBoardJwt,
} from './lib/sceneBoardHmac.js'
import {
  getSceneBoardJwtSecret,
  getSupabaseServiceRoleKey,
  getSupabaseUrlForServer,
} from './lib/supabaseServerEnv.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  applyApiCors(req, res, 'PUT, OPTIONS')
  if (req.method === 'OPTIONS') {
    if (!isCorsOriginAllowed(req)) {
      res.status(403).end()
      return
    }
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

    let body: Record<string, unknown>
    try {
      body = parseVercelJsonBody(req)
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        res.status(413).json({ error: 'Request body too large' })
        return
      }
      throw e
    }
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
      logServerError('[scene-board] upsert', error)
      res.status(500).json({ error: GENERIC_INTERNAL_ERROR })
      return
    }

    res.status(200).json({ ok: true })
  } catch (e) {
    logServerError('[scene-board] unhandled', e)
    if (res.headersSent) return
    res.status(500).json({ error: GENERIC_INTERNAL_ERROR })
  }
}
