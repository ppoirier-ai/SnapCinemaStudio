/** Default MORTAL coin page; override with `VITE_MORTAL_PUMP_FUN_URL`. */
const DEFAULT_MORTAL_PUMP_FUN_URL =
  'https://pump.fun/coin/GY18xEB7eLCUJ4b8FSQuA4SHhhD4U4ZNv9yDarwJpump'

export function getMortalPumpFunUrl(): string | undefined {
  const raw = import.meta.env.VITE_MORTAL_PUMP_FUN_URL as string | undefined
  const t = (raw?.trim() || DEFAULT_MORTAL_PUMP_FUN_URL).trim()
  if (!t) return undefined
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined
    return t
  } catch {
    return undefined
  }
}
