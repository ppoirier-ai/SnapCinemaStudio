import type { VercelRequest } from '@vercel/node'

/**
 * Best-effort client IP for rate limiting (Vercel sets x-forwarded-for).
 */
export function clientIp(req: VercelRequest): string {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) {
    const first = xf.split(',')[0]?.trim()
    if (first) return first
  }
  const xr = req.headers['x-real-ip']
  if (typeof xr === 'string' && xr.trim()) return xr.trim()
  const ra = (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress
  return ra && ra.trim() ? ra.trim() : 'unknown'
}
