import { createClient } from '@supabase/supabase-js'
import {
  supabaseAnonKeyForClient,
  supabaseUrlForClient,
} from '../lib/supabaseClientEnv'

export function createSceneBoardSupabase() {
  const url = supabaseUrlForClient()
  const key = supabaseAnonKeyForClient()
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url.trim(), key.trim())
}

export type SceneBoardDbRow = {
  creator_wallet: string
  payload: unknown
  updated_at: string
}

export async function fetchSceneBoardForWallet(
  client: NonNullable<ReturnType<typeof createSceneBoardSupabase>>,
  creatorWallet: string,
): Promise<SceneBoardDbRow | null> {
  const { data, error } = await client
    .from('scene_boards')
    .select('creator_wallet, payload, updated_at')
    .eq('creator_wallet', creatorWallet)
    .maybeSingle()

  if (error) {
    console.warn('[scene-board] Supabase read error:', error.message)
    return null
  }
  if (!data) return null
  return data as SceneBoardDbRow
}

/** All creator rows; used so the slot authority sees movies from every contributor wallet. */
export async function fetchAllSceneBoardRows(
  client: NonNullable<ReturnType<typeof createSceneBoardSupabase>>,
): Promise<SceneBoardDbRow[]> {
  const { data, error } = await client
    .from('scene_boards')
    .select('creator_wallet, payload, updated_at')

  if (error) {
    console.warn('[scene-board] Supabase read all error:', error.message)
    return []
  }
  return (data ?? []) as SceneBoardDbRow[]
}
