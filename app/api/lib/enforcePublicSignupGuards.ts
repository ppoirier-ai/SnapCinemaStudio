import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clientIp } from './clientIp.js'
import { consumePublicSignupRate } from './rateLimitPublicSignup.js'
import {
  turnstileSecretConfigured,
  verifyTurnstileToken,
} from './verifyTurnstile.js'

function turnstileTokenFromBody(body: Record<string, unknown>): string | undefined {
  const a = body.cf_turnstile_response
  const b = body.turnstileToken
  if (typeof a === 'string' && a.trim()) return a.trim()
  if (typeof b === 'string' && b.trim()) return b.trim()
  return undefined
}

/**
 * Rate limit + optional Turnstile for anonymous signup routes. Sends JSON error responses on failure.
 */
export async function enforcePublicSignupGuards(
  req: VercelRequest,
  res: VercelResponse,
  body: Record<string, unknown>,
): Promise<boolean> {
  const ip = clientIp(req)

  if (!(await consumePublicSignupRate(ip))) {
    res.status(429).json({ error: 'Too many requests. Try again shortly.' })
    return false
  }

  if (turnstileSecretConfigured()) {
    const token = turnstileTokenFromBody(body)
    const ok = await verifyTurnstileToken(token, ip)
    if (!ok) {
      res.status(400).json({ error: 'Captcha verification failed.' })
      return false
    }
  }

  return true
}
