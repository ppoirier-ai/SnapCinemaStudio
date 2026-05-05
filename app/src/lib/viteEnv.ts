/**
 * Read Vite (`import.meta.env`) or Node (`process.env`) — workers and Vercel APIs must not assume `import.meta.env` exists.
 */
export function readViteOrProcessEnv(name: string): string | undefined {
  const im =
    typeof import.meta !== 'undefined'
      ? (import.meta as ImportMeta & { env?: Record<string, string> }).env
      : undefined
  const fromVite = im?.[name]
  if (fromVite != null && String(fromVite).trim() !== '') return String(fromVite)
  if (typeof process !== 'undefined') {
    const p = process.env[name]
    if (p != null && String(p).trim() !== '') return String(p)
  }
  return undefined
}
