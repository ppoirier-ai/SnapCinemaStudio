import type { MoviesUIState } from './sceneBoardModel'
import { isSceneBoardCloudPayloadV1, type SceneBoardCloudPayloadV1 } from './sceneBoardTypes'
import { sceneBoardCloudConfigured } from './sceneBoardEnv'
import {
  createSceneBoardSupabase,
  fetchAllSceneBoardRows,
} from './sceneBoardSupabase'
import { sliceStateForWallet } from './sceneBoardMerge'
import type { SceneBoardRemoteRow } from './sceneBoardMerge'
import { ensureBoardApiSession, sceneBoardApiUrl } from './sceneBoardSession'

export { sceneBoardCloudConfigured, sceneBoardPublisherWallet } from './sceneBoardEnv'
export { mergeRemoteSceneBoardRows, sliceStateForWallet } from './sceneBoardMerge'

/** Loads every creator row so the authority (same wallet as publisher) still merges other wallets’ movies. */
export async function loadRemoteSceneBoardRows(): Promise<SceneBoardRemoteRow[]> {
  const client = createSceneBoardSupabase()
  if (!client) return []
  const rows = await fetchAllSceneBoardRows(client)
  const out: SceneBoardRemoteRow[] = []
  for (const row of rows) {
    if (!isSceneBoardCloudPayloadV1(row.payload)) continue
    out.push({ creator_wallet: row.creator_wallet, payload: row.payload })
  }
  return out
}

export async function pushSceneBoardForWallet(
  wallet: string,
  fullState: MoviesUIState,
  signMessage: ((msg: Uint8Array) => Promise<Uint8Array>) | undefined,
): Promise<boolean> {
  if (!sceneBoardCloudConfigured()) return false
  const token = await ensureBoardApiSession(wallet, signMessage)
  if (!token) return false
  const slice = sliceStateForWallet(fullState, wallet)
  const envelope: SceneBoardCloudPayloadV1 = {
    v: 1,
    updatedAtMs: Date.now(),
    state: slice,
  }
  const res = await fetch(sceneBoardApiUrl('/api/scene-board'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ payload: envelope }),
  })
  if (!res.ok) {
    console.warn('[scene-board] push HTTP', res.status, await res.text())
    return false
  }
  return true
}
