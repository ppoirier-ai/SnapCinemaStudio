import type { VercelRequest } from '@vercel/node'

/** Aligned with typical serverless JSON payloads; tune via env `API_MAX_JSON_BODY_BYTES`. */
export function maxJsonBodyBytes(): number {
  const raw = process.env.API_MAX_JSON_BODY_BYTES?.trim()
  if (!raw) return 262_144
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 4 * 1024 * 1024) : 262_144
}

export class PayloadTooLargeError extends Error {
  readonly statusCode = 413
  constructor() {
    super('Payload too large')
    this.name = 'PayloadTooLargeError'
  }
}

/**
 * Uses Content-Length when present. For parsed objects without raw body, callers should validate separately.
 */
export function assertJsonBodyWithinContentLength(req: VercelRequest): void {
  const cl = req.headers['content-length']
  if (cl == null || cl === '') return
  const n = Number(cl)
  if (!Number.isFinite(n) || n < 0) return
  if (n > maxJsonBodyBytes()) throw new PayloadTooLargeError()
}

export function assertBufferWithinLimit(buf: Buffer): void {
  if (buf.length > maxJsonBodyBytes()) throw new PayloadTooLargeError()
}

export function assertUtf8StringWithinLimit(s: string): void {
  if (Buffer.byteLength(s, 'utf8') > maxJsonBodyBytes()) {
    throw new PayloadTooLargeError()
  }
}
