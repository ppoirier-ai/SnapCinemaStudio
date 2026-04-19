import Clarity from '@microsoft/clarity'

let started = false

/** Loads Clarity only when `VITE_CLARITY_PROJECT_ID` is set (build-time env). */
export function initClarity(): void {
  if (started) return
  const id = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim()
  if (!id) return
  Clarity.init(id)
  started = true
}

export function claritySetTag(key: string, value: string): void {
  if (!started) return
  try {
    Clarity.setTag(key, value)
  } catch {
    /* script may still be loading */
  }
}

export function clarityEvent(name: string): void {
  if (!started) return
  try {
    Clarity.event(name)
  } catch {
    /* script may still be loading */
  }
}
