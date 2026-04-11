import type { SceneColumn } from '../context/SceneBoardContext'
import { extractYoutubeVideoId } from './youtubeUrl'

/** Cells in this column that have a readable YouTube id, in row order. */
export function playableCellsInOrder(col: SceneColumn) {
  return col.cells.filter((c) => !!extractYoutubeVideoId(c.youtubeUrl ?? ''))
}

/**
 * When a time column has exactly two playable clips, the first row maps to
 * on-chain fork 0 and the second to fork 1 (matches Watch playlist pairing).
 */
export function forkIndexForPlayableCell(
  col: SceneColumn,
  cellId: string,
): 0 | 1 | null {
  const playables = playableCellsInOrder(col)
  if (playables.length !== 2) return null
  const idx = playables.findIndex((c) => c.id === cellId)
  if (idx !== 0 && idx !== 1) return null
  return idx as 0 | 1
}

export function playableVideoCount(col: SceneColumn): number {
  return playableCellsInOrder(col).length
}

/**
 * Fork index for **tooltips** only: the first playable cell in row order maps to
 * fork 0 and the second to fork 1, even when the column does not yet have two
 * clips (so hover matches Watch once the second clip exists). Third and later
 * playables return null.
 */
export function tooltipForkForPlayableCell(
  col: SceneColumn,
  cellId: string,
): 0 | 1 | null {
  const playables = playableCellsInOrder(col)
  const idx = playables.findIndex((c) => c.id === cellId)
  if (idx === 0) return 0
  if (idx === 1) return 1
  return null
}
