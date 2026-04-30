/** EverRise DEX URL for purchasing $SNAP (referral-aware). Override with `VITE_EVERRISE_SNAP_URL` if needed. */
const DEFAULT_SNAP_BUY_URL =
  'https://www.everrise.club?ref=FEVyge83aMu6gP2uSXUFFH7ujVs2SQqfA425S7mJJGqA'

export function getEverriseSnapBuyUrl(): string {
  const raw = import.meta.env.VITE_EVERRISE_SNAP_URL as string | undefined
  const t = raw?.trim()
  if (!t) return DEFAULT_SNAP_BUY_URL
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return DEFAULT_SNAP_BUY_URL
    return t
  } catch {
    return DEFAULT_SNAP_BUY_URL
  }
}
