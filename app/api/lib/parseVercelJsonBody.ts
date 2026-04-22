import type { VercelRequest } from '@vercel/node'

/**
 * Vercel may leave `body` as a parsed object, a string, or a Buffer. Buffers
 * are `typeof 'object'`; treat them as raw JSON text.
 */
export function parseVercelJsonBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8') || '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }
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
