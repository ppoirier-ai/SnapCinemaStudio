/**
 * Wallet session for scene board HMAC tokens. **Separate Vercel function** from
 * `scene-board.ts` so this route does not load `@supabase/supabase-js` (smaller
 * bundle; Watch auto-calls session on load when cloud sync is on).
 */
import { verifyAsync } from '@noble/ed25519'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseVercelJsonBody } from './lib/parseVercelJsonBody'
import { signBoardJwt } from './lib/sceneBoardHmac'
import { decodeBase58Ed25519Pubkey } from './lib/solanaPubkeyBytes'
import { getSceneBoardJwtSecret } from './lib/supabaseServerEnv'

const MSG_RE =
  /^SnapCinema:scene-board:v1:([^:]+):(\d+):([0-9a-f-]{36})$/i

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    cors(res)
    if (req.method === 'OPTIONS') {
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

    const body = parseVercelJsonBody(req)
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

    const m = MSG_RE.exec(message)
    if (!m) {
      res.status(400).json({ error: 'Invalid message format' })
      return
    }
    const msgWallet = m[1]
    const ts = Number(m[2])
    if (msgWallet !== wallet) {
      res.status(400).json({ error: 'Wallet mismatch' })
      return
    }
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 15 * 60_000) {
      res.status(400).json({ error: 'Stale or invalid timestamp' })
      return
    }

    const pub = decodeBase58Ed25519Pubkey(wallet)
    if (!pub) {
      res.status(400).json({ error: 'Invalid wallet' })
      return
    }

    let sig: Uint8Array
    try {
      sig = new Uint8Array(Buffer.from(sigB64, 'base64'))
    } catch {
      res.status(400).json({ error: 'Invalid signature encoding' })
      return
    }
    if (sig.length !== 64) {
      res.status(400).json({ error: 'Invalid signature length' })
      return
    }

    const msgBytes = Buffer.from(message, 'utf8')
    let ok: boolean
    try {
      ok = await verifyAsync(sig, msgBytes, pub)
    } catch (e) {
      console.error('[scene-board-session] verifyAsync', e)
      res.status(400).json({ error: 'Signature verification error' })
      return
    }
    if (!ok) {
      res.status(401).json({ error: 'Signature verification failed' })
      return
    }

    const expSec = Math.floor(Date.now() / 1000) + 86_400
    const token = signBoardJwt(wallet, expSec, jwtSecret)
    res.status(200).json({ token, expSec })
  } catch (e) {
    console.error('[scene-board-session] unhandled', e)
    if (res.headersSent) return
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
