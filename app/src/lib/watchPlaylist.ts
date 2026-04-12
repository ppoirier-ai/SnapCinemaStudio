import type { Movie, SceneCell } from '../context/SceneBoardContext'
import { sceneKeyHex } from '../stakeToCurate/sceneKey'
import { extractYoutubeVideoId } from './youtubeUrl'
import { sampleWeightedIndexWithTrace } from '../stakeToCurate/client'

/**
 * Verbose playlist / weight logging for debugging Watch picks.
 * - Dev server: on by default; silence with `localStorage.snapcinema_debug_playlist='0'`.
 * - Production: set `localStorage.snapcinema_debug_playlist='1'` or `VITE_DEBUG_PLAYLIST=true`.
 */
export function watchPlaylistDebugEnabled(): boolean {
  if (import.meta.env.VITE_DEBUG_PLAYLIST === 'false') return false
  try {
    const ls = globalThis.localStorage?.getItem('snapcinema_debug_playlist')
    if (ls === '0') return false
    if (ls === '1') return true
  } catch {
    /* private mode */
  }
  if (import.meta.env.VITE_DEBUG_PLAYLIST === 'true') return true
  return Boolean(import.meta.env.DEV)
}

export type WatchPlaylistClip = {
  videoId: string
  columnIndex: number
  cellId: string
  columnId: string
  /** 64-char hex; matches on-chain `scene_key` PDA seed. */
  sceneKeyHex: string
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

/** Integer sqrt (floor) for bigint — used to soften rank spread for Watch-only picks. */
function bigintSqrtFloor(n: bigint): bigint {
  if (n <= 0n) return 0n
  if (n < 4n) return 1n
  let x = n
  let y = (x + 1n) / 2n
  while (y < x) {
    x = y
    y = (x + n / x) / 2n
  }
  return x
}

/**
 * Watch playback weights for choosing among alternates: still favors higher on-chain rank,
 * but avoids ~100% picks when one scene has MIN_INITIAL_RANK (1e6) and another uses a small
 * default — on-chain staking still uses full rank.
 */
function watchAlternatePickWeight(rank: bigint): bigint {
  const r = rank > 0n ? rank : 1n
  // Floor so a 1_000_000 anchor rank vs a default `1` are not ~1e6:1 in Watch picks.
  return bigintSqrtFloor(r) + 1000n
}

/** Dedupe identical playlist builds (React Strict Mode + frequent useMemo). */
let lastPlaylistDebugDigest = ''

type PlaylistDebugRow = {
  timeColumn: number
  branch: string
  pickVideoId: string
  note: string
  drawU?: string
  weightSum?: string
  weights?: string
}

function logWeightedTraceLine(trace: ReturnType<typeof sampleWeightedIndexWithTrace>): string {
  const wStr = trace.weights.map((w) => w.toString()).join(', ')
  if (trace.usedUniformFallback) {
    return `all weights 0 → uniform index ${trace.index} (n=${trace.weights.length})`
  }
  return `weights=[${wStr}] sum=${trace.weightSum.toString()} drawU=${trace.drawU?.toString() ?? 'n/a'} → index=${trace.index}`
}

/**
 * One clip per column (left → right). Alternatives in a column use **local** weights only:
 * on-chain `Scene.rank` when available in `rankBySceneKeyHex`, otherwise the cell’s
 * configured `rank` string (default 1). No global v0/v1 playback.
 */
export function buildWatchPlaylist(
  movie: Movie,
  rankBySceneKeyHex: Record<string, bigint>,
): WatchPlaylistClip[] {
  const clips: WatchPlaylistClip[] = []
  const debug = watchPlaylistDebugEnabled()
  const debugRows: PlaylistDebugRow[] = []

  movie.columns.forEach((col, columnIndex) => {
    type Play = {
      videoId: string
      rank: bigint
      cellId: string
      columnId: string
      sceneKeyHex: string
    }
    const playable: Play[] = []
    for (const cell of col.cells) {
      if (!cell.youtubeUrl) continue
      const vid = extractYoutubeVideoId(cell.youtubeUrl)
      if (!vid) continue
      const skh = sceneKeyHex(movie.id, col.id, cell.id)
      const chain = rankBySceneKeyHex[skh]
      playable.push({
        videoId: vid,
        rank: chain ?? cellStakeRank(cell),
        cellId: cell.id,
        columnId: col.id,
        sceneKeyHex: skh,
      })
    }
    if (playable.length === 0) return

    let pick: Play
    if (playable.length >= 2) {
      const trace = sampleWeightedIndexWithTrace(
        playable.map((p) => watchAlternatePickWeight(p.rank)),
      )
      const idx = trace.index
      pick = playable[idx]!
      if (debug) {
        const chainNote = playable.some((p) => rankBySceneKeyHex[p.sceneKeyHex] != null)
          ? 'on-chain ranks where registered; cell rank fallback otherwise'
          : 'no on-chain ranks in map yet — cell defaults / local rank strings'
        debugRows.push({
          timeColumn: columnIndex + 1,
          branch: `${playable.length} playables (per-column weighted)`,
          pickVideoId: pick.videoId,
          note: `${chainNote}. ${logWeightedTraceLine(trace)}`,
          drawU: trace.drawU?.toString(),
          weightSum: trace.weightSum.toString(),
          weights: trace.weights.map((w) => w.toString()).join(','),
        })
      }
    } else {
      pick = playable[0]!
      if (debug) {
        debugRows.push({
          timeColumn: columnIndex + 1,
          branch: 'single playable',
          pickVideoId: pick.videoId,
          note: 'no alternates',
        })
      }
    }
    clips.push({
      videoId: pick.videoId,
      columnIndex,
      cellId: pick.cellId,
      columnId: pick.columnId,
      sceneKeyHex: pick.sceneKeyHex,
    })
  })

  if (debug && debugRows.length > 0) {
    const digest = [
      movie.id,
      clips.map((c) => `${c.sceneKeyHex}:${c.videoId}`).join('>'),
      JSON.stringify(
        Object.fromEntries(
          clips.map((c) => [c.sceneKeyHex, rankBySceneKeyHex[c.sceneKeyHex]?.toString() ?? '']),
        ),
      ),
    ].join('|')
    if (digest !== lastPlaylistDebugDigest) {
      lastPlaylistDebugDigest = digest
      console.groupCollapsed(
        `[SnapCinema:playlist] Watch playlist build (${debugRows.length} time column(s))`,
      )
      console.table(debugRows)
      console.info(
        'Dedupe: identical digest is not logged again (avoids Strict Mode / useMemo spam). Silence: localStorage.snapcinema_debug_playlist="0"',
      )
      console.groupEnd()
    }
  }

  return clips
}
