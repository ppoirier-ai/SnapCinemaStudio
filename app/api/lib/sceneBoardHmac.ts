import { createHmac, timingSafeEqual } from 'node:crypto'

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

export function signBoardJwt(
  wallet: string,
  expSec: number,
  secret: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({ w: wallet, exp: expSec }),
    'utf8',
  )
  const p = b64url(payload)
  const mac = createHmac('sha256', secret).update(p).digest()
  return `${p}.${b64url(mac)}`
}

export function verifyBoardJwt(
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

export function isCloudPayloadV1(x: unknown): x is {
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
