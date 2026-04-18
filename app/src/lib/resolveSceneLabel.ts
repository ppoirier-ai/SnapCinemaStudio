import type { Movie } from '../storage/sceneBoardModel'
import { sceneKeyHex as sceneKeyHexFromIds } from '../stakeToCurate/sceneKey'

export type ResolvedSceneLabel = {
  movieTitle: string
  /** 1-based column index for display ("Time n") */
  timeNumber: number
  /** 1-based cell index within column ("Alt m") */
  altNumber: number
  movieId: string
}

/**
 * Find which movie/column/cell produced this on-chain scene key (64 hex chars).
 */
export function resolveSceneFromHex(
  movies: Movie[],
  sceneKeyHex: string,
): ResolvedSceneLabel | null {
  const target = sceneKeyHex.trim().toLowerCase()
  for (const m of movies) {
    for (let ci = 0; ci < m.columns.length; ci++) {
      const col = m.columns[ci]!
      for (let ai = 0; ai < col.cells.length; ai++) {
        const cell = col.cells[ai]!
        const h = sceneKeyHexFromIds(m.id, col.id, cell.id).toLowerCase()
        if (h === target) {
          return {
            movieTitle: m.title.trim() || 'Untitled',
            timeNumber: ci + 1,
            altNumber: ai + 1,
            movieId: m.id,
          }
        }
      }
    }
  }
  return null
}
