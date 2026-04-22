import { supabaseClientConfigured } from '../lib/supabaseClientEnv'
import { stakeSlotAuthorityFromEnv } from '../stakeToCurate/client'

export function sceneBoardCloudConfigured(): boolean {
  return supabaseClientConfigured()
}

/**
 * When set, Watch / all users merge this wallet’s cloud row (same as shared slot authority).
 */
export function sceneBoardPublisherWallet(): string | null {
  const pk = stakeSlotAuthorityFromEnv()
  return pk ? pk.toBase58() : null
}
