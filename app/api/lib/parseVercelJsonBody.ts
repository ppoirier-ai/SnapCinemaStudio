import type { VercelRequest } from '@vercel/node'
import {
  assertBufferWithinLimit,
  assertJsonBodyWithinContentLength,
  assertUtf8StringWithinLimit,
  maxJsonBodyBytes,
  PayloadTooLargeError,
} from './requestLimits.js'

/**
 * Vercel may leave `body` as a parsed object, a string, or a Buffer. Buffers
 * are `typeof 'object'`; treat them as raw JSON text.
 */
export function parseVercelJsonBody(req: VercelRequest): Record<string, unknown> {
  assertJsonBodyWithinContentLength(req)
  const b = req.body

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(b)) {
    assertBufferWithinLimit(b)
    try {
      return JSON.parse(b.toString('utf8') || '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (b && typeof b === 'object' && !Array.isArray(b)) {
    const o = b as Record<string, unknown>
    let encoded: string
    try {
      encoded = JSON.stringify(o)
    } catch {
      return {}
    }
    if (Buffer.byteLength(encoded, 'utf8') > maxJsonBodyBytes()) {
      throw new PayloadTooLargeError()
    }
    return o
  }
  if (typeof b === 'string') {
    assertUtf8StringWithinLimit(b)
    try {
      return JSON.parse(b || '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}
