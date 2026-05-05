import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let signupLimiter: Ratelimit | null | undefined

function getSignupLimiter(): Ratelimit | null {
  if (signupLimiter !== undefined) return signupLimiter
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    signupLimiter = null
    return null
  }
  try {
    const redis = new Redis({ url, token })
    signupLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      prefix: 'snapcinema:signup',
    })
    return signupLimiter
  } catch (e) {
    console.error('[rateLimitPublicSignup] init', e)
    signupLimiter = null
    return null
  }
}

/**
 * Returns whether the request should proceed. Without Upstash env, allows all traffic (not suitable for
 * high-risk production — configure `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`).
 */
export async function consumePublicSignupRate(ip: string): Promise<boolean> {
  const lim = getSignupLimiter()
  if (!lim) return true
  const { success } = await lim.limit(ip)
  return success
}
