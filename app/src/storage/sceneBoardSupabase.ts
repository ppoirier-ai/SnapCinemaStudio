import { createClient } from '@supabase/supabase-js'

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

export function createSceneBoardSupabase() {
  const url = readViteEnv('VITE_SUPABASE_URL')
  const key = readViteEnv('VITE_SUPABASE_ANON_KEY')
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
