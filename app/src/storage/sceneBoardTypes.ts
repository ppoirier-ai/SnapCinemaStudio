import type { MoviesUIState } from './sceneBoardModel'

/** Wire format for Supabase `scene_boards.payload` and API bodies. */
export type SceneBoardCloudPayloadV1 = {
  v: 1
  /** Client clock at save time; used for merge conflicts. */
  updatedAtMs: number
  state: MoviesUIState
}

export function isSceneBoardCloudPayloadV1(
  x: unknown,
): x is SceneBoardCloudPayloadV1 {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  const st = o.state
  if (st == null || typeof st !== 'object') return false
  const movies = (st as Record<string, unknown>).movies
  return o.v === 1 && typeof o.updatedAtMs === 'number' && Array.isArray(movies)
}
