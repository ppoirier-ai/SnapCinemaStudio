import { verifyAsync } from '@noble/ed25519'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { PublicKey } from '@solana/web3.js'
import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  getSceneBoardJwtSecret,
  getSupabaseServiceRoleKey,
  getSupabaseUrlForServer,
} from './lib/supabaseServerEnv'

const MSG_RE =
  /^SnapCinema:scene-board:v1:([^:]+):(\d+):([0-9a-f-]{36})$/i

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS')
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlToBuf(s: string): Buffer {
  const pad = 4 - (s.length % 4 || 4)
  const b64 = (s + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64')
}

function signBoardJwt(wallet: string, expSec: number, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ w: wallet, exp: expSec }),
    'utf8',
  )
  const p = b64url(payload)
  const mac = createHmac('sha256', secret).update(p).digest()
  return `${p}.${b64url(mac)}`
}

function verifyBoardJwt(
  token: string,
  secret: string,
): { wallet: string } | null {
  const i = token.lastIndexOf('.')
  if (i <= 0) return null
  const p = token.slice(0, i)
  const sig = token.slice(i + 1)
  const mac = createHmac('sha256', secret).update(p).digest()
  let sigBuf: Buffer
  try {
    sigBuf = b64urlToBuf(sig)
  } catch {
    return null
  }
  if (sigBuf.length !== mac.length || !timingSafeEqual(sigBuf, mac)) return null
  let payload: { w?: string; exp?: number }
  try {
    payload = JSON.parse(b64urlToBuf(p).toString('utf8')) as {
      w?: string
      exp?: number
    }
  } catch {
    return null
  }
  if (!payload.w || typeof payload.exp !== 'number') return null
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return { wallet: payload.w }
}

function getJsonBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body
  if (b && typeof b === 'object' && !Array.isArray(b)) {
    return b as Record<string, unknown>
  }
  if (typeof b === 'string') {
    try {
      return JSON.parse(b || '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

function isCloudPayloadV1(x: unknown): x is {
  v: 1
  updatedAtMs: number
  state: object
} {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    o.v === 1 &&
    typeof o.updatedAtMs === 'number' &&
    o.state != null &&
    typeof o.state === 'object'
  )
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

  if (req.method === 'POST') {
    const body = getJsonBody(req)
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

    let pub: PublicKey
    try {
      pub = new PublicKey(wallet)
    } catch {
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
    const ok = await verifyAsync(sig, msgBytes, pub.toBytes())
    if (!ok) {
      res.status(401).json({ error: 'Signature verification failed' })
      return
    }

    const expSec = Math.floor(Date.now() / 1000) + 86_400
    const token = signBoardJwt(wallet, expSec, jwtSecret)
    res.status(200).json({ token, expSec })
    return
  }

  if (req.method === 'PUT') {
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

    const body = getJsonBody(req)
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
    return
  }

  res.setHeader('Allow', 'POST, PUT, OPTIONS')
  res.status(405).json({ error: 'Method not allowed' })
}
