import type { MoviesUIState } from './sceneBoardModel'
import { isSceneBoardCloudPayloadV1, type SceneBoardCloudPayloadV1 } from './sceneBoardTypes'
import { sceneBoardCloudConfigured } from './sceneBoardEnv'
import {
  createSceneBoardSupabase,
  fetchSceneBoardForWallet,
} from './sceneBoardSupabase'
import { sliceStateForWallet } from './sceneBoardMerge'
import type { SceneBoardRemoteRow } from './sceneBoardMerge'
import { ensureBoardApiSession, sceneBoardApiUrl } from './sceneBoardSession'

export { sceneBoardCloudConfigured, sceneBoardPublisherWallet } from './sceneBoardEnv'
export { mergeRemoteSceneBoardRows, sliceStateForWallet } from './sceneBoardMerge'

export async function loadRemoteSceneBoardRows(
  wallets: string[],
): Promise<SceneBoardRemoteRow[]> {
  const client = createSceneBoardSupabase()
  if (!client) return []
  const uniq = [...new Set(wallets.filter(Boolean))]
  const out: SceneBoardRemoteRow[] = []
  for (const w of uniq) {
    const row = await fetchSceneBoardForWallet(client, w)
    if (!row) continue
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
