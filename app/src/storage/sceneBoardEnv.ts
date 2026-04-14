import { stakeSlotAuthorityFromEnv } from '../stakeToCurate/client'

function readViteEnv(name: string): string | undefined {
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

export function sceneBoardCloudConfigured(): boolean {
  const url = readViteEnv('VITE_SUPABASE_URL')
  const key = readViteEnv('VITE_SUPABASE_ANON_KEY')
  return Boolean(url?.trim() && key?.trim())
}

/**
 * When set, Watch / all users merge this wallet’s cloud row (same as shared slot authority).
 */
export function sceneBoardPublisherWallet(): string | null {
  const pk = stakeSlotAuthorityFromEnv()
  return pk ? pk.toBase58() : null
}
