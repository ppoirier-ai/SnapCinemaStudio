/** pump.fun URL for MORTAL; set `VITE_MORTAL_PUMP_FUN_URL` when the page is live. */
export function getMortalPumpFunUrl(): string | undefined {
  const raw = import.meta.env.VITE_MORTAL_PUMP_FUN_URL as string | undefined
  const t = raw?.trim()
  if (!t) return undefined
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined
    return t
  } catch {
    return undefined
  }
}
