/**
 * Wallet session for scene board HMAC tokens. **Separate Vercel function** from
 * `scene-board.ts` so this route does not load `@supabase/supabase-js` (smaller
 * bundle; Watch auto-calls session on load when cloud sync is on).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GENERIC_INTERNAL_ERROR, logServerError } from './lib/apiErrors.js'
import { applyApiCors, isCorsOriginAllowed } from './lib/cors.js'
import { parseVercelJsonBody } from './lib/parseVercelJsonBody.js'
import { PayloadTooLargeError } from './lib/requestLimits.js'
import { signBoardJwt } from './lib/sceneBoardHmac.js'
import { getSceneBoardJwtSecret } from './lib/supabaseServerEnv.js'
import { verifySolanaWalletSignMessage } from './lib/verifySolanaWalletSignMessage.js'

const MSG_RE =
  /^SnapCinema:scene-board:v1:([^:]+):(\d+):([0-9a-f-]{36})$/i

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    applyApiCors(req, res, 'POST, OPTIONS')
    if (req.method === 'OPTIONS') {
      if (!isCorsOriginAllowed(req)) {
        res.status(403).end()
        return
      }
      res.status(204).end()
      return
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const jwtSecret = getSceneBoardJwtSecret()
    if (!jwtSecret) {
      res.status(503).json({
        error:
          'Server missing JWT secret for scene board (SUPABASE_JWT_SECRET or SCENE_BOARD_JWT_SECRET)',
      })
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
    if (body.op !== 'session') {
      res.status(400).json({ error: 'Expected op: session' })
      return
    }
    const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
    const message = typeof body.message === 'string' ? body.message : ''
    const sigB64 = typeof body.signature === 'string' ? body.signature : ''
    if (!wallet || !message || !sigB64) {
      res.status(400).json({ error: 'wallet, message, signature required' })
      return
    }

    const verified = await verifySolanaWalletSignMessage({
      wallet,
      message,
      signatureBase64: sigB64,
      messageRegex: MSG_RE,
    })
    if (!verified.ok) {
      const status =
        verified.error === 'Signature verification failed' ? 401 : 400
      res.status(status).json({ error: verified.error })
      return
    }

    const expSec = Math.floor(Date.now() / 1000) + 86_400
    const token = signBoardJwt(wallet, expSec, jwtSecret)
    res.status(200).json({ token, expSec })
  } catch (e) {
    logServerError('[scene-board-session] unhandled', e)
    if (res.headersSent) return
    res.status(500).json({ error: GENERIC_INTERNAL_ERROR })
  }
}
