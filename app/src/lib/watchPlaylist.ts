import type { Movie, SceneCell } from '../context/SceneBoardContext'
import { extractYoutubeVideoId } from './youtubeUrl'
import {
  sampleVersionIndex,
  sampleWeightedIndex,
} from '../stakeToCurate/client'

export type WatchPlaylistClip = {
  videoId: string
  columnIndex: number
}

function cellStakeRank(cell: SceneCell): bigint {
  if (typeof cell.rank === 'string' && cell.rank.trim()) {
    try {
      const x = BigInt(cell.rank.trim())
      return x > 0n ? x : 1n
    } catch {
      return 1n
    }
  }
  return 1n
}

type ChainPick = {
  v0: { rank: bigint } | null
  v1: { rank: bigint } | null
  playback: 0 | 1 | null
}

/**
 * One clip per column (left → right). Alternatives in a column:
 * — Exactly two playable cells and both on-chain versions exist: use `playback`
 *   so stakes match the sampled StakeToCurate version.
 * — Otherwise: weighted random by per-cell `rank` (default 1).
 */
export function buildWatchPlaylist(
  movie: Movie,
  chain: ChainPick,
): WatchPlaylistClip[] {
  const clips: WatchPlaylistClip[] = []
  const { v0, v1, playback } = chain

  movie.columns.forEach((col, columnIndex) => {
    const playable: { videoId: string; rank: bigint }[] = []
    for (const cell of col.cells) {
      if (!cell.youtubeUrl) continue
      const vid = extractYoutubeVideoId(cell.youtubeUrl)
      if (vid) playable.push({ videoId: vid, rank: cellStakeRank(cell) })
    }
    if (playable.length === 0) return

    let pick: (typeof playable)[0]
    if (playable.length === 2 && v0 && v1) {
      const idx =
        playback === 0 || playback === 1
          ? playback
          : sampleVersionIndex([v0.rank, v1.rank])
      pick = playable[idx]!
    } else if (playable.length >= 2) {
      const idx = sampleWeightedIndex(playable.map((p) => p.rank))
      pick = playable[idx]!
    } else {
      pick = playable[0]!
    }
    clips.push({ videoId: pick.videoId, columnIndex })
  })
  return clips
}
