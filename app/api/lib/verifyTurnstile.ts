/**
 * Optional Cloudflare Turnstile on public signup routes. Set `TURNSTILE_SECRET_KEY` on the server and
 * `VITE_TURNSTILE_SITE_KEY` on the client widget.
 */
export function turnstileSecretConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim())
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp: string | undefined,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return true
  if (!token?.trim()) return false

  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token.trim())
  if (remoteIp && remoteIp !== 'unknown') {
    body.set('remoteip', remoteIp)
  }

  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  )

  if (!res.ok) {
    console.error('[turnstile] siteverify HTTP', res.status)
    return false
  }

  const json = (await res.json()) as { success?: boolean }
  return json.success === true
}
