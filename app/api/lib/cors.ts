import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Comma-separated allowed browser origins (scheme + host + port). If unset, sends `*` (dev-friendly;
 * set in production). Example: `https://snapcinema.example,http://localhost:5173`
 */
function corsAllowlist(): string[] | null {
  const raw = process.env.API_CORS_ORIGINS?.trim()
  if (!raw) return null
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return list.length ? list : null
}

function requestOrigin(req: VercelRequest): string {
  const o = req.headers.origin
  return typeof o === 'string' ? o.trim() : ''
}

/**
 * Whether this Origin may use CORS for this API (preflight or actual request).
 */
export function isCorsOriginAllowed(req: VercelRequest): boolean {
  const list = corsAllowlist()
  if (!list) return true
  const origin = requestOrigin(req)
  if (!origin) return true
  return list.includes(origin)
}

/**
 * Sets Access-Control-* headers. In allowlist mode, echoes an allowed Origin; otherwise `*`.
 */
export function applyApiCors(
  req: VercelRequest,
  res: VercelResponse,
  allowedMethods: string,
): void {
  const list = corsAllowlist()
  const origin = requestOrigin(req)
  if (!list) {
    res.setHeader('Access-Control-Allow-Origin', '*')
  } else if (origin && list.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  } else if (origin) {
    res.setHeader('Vary', 'Origin')
  }

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  res.setHeader('Access-Control-Allow-Methods', allowedMethods)
}
