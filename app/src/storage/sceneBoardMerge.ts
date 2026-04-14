import type { Movie, MoviesUIState } from './sceneBoardModel'
import type { SceneBoardCloudPayloadV1 } from './sceneBoardTypes'

export type SceneBoardRemoteRow = {
  creator_wallet: string
  payload: SceneBoardCloudPayloadV1
}

function pickValidId(
  preferred: string | null,
  movies: Movie[],
): string | null {
  if (preferred && movies.some((m) => m.id === preferred)) return preferred
  return movies[0]?.id ?? null
}

export function sliceStateForWallet(
  full: MoviesUIState,
  wallet: string,
): MoviesUIState {
  const movies = full.movies.filter((m) => m.creatorWallet === wallet)
  return {
    movies,
    selectedMovieId: pickValidId(full.selectedMovieId, movies),
    creatorSelectedMovieId: pickValidId(full.creatorSelectedMovieId, movies),
    watchMovieId: pickValidId(full.watchMovieId, movies),
  }
}

export function mergeRemoteSceneBoardRows(
  local: MoviesUIState,
  localWriteMs: number,
  remotes: SceneBoardRemoteRow[],
): MoviesUIState {
  const byId = new Map<string, { m: Movie; t: number }>()
  for (const m of local.movies) {
    byId.set(m.id, { m, t: localWriteMs })
  }
  for (const row of remotes) {
    const t = row.payload.updatedAtMs
    const rowMovies = row.payload.state.movies
    if (!Array.isArray(rowMovies)) continue
    for (const m of rowMovies) {
      if (m.creatorWallet !== row.creator_wallet) continue
      const prev = byId.get(m.id)
      if (!prev || t >= prev.t) {
        byId.set(m.id, { m, t })
      }
    }
  }
  const movies = [...byId.values()]
    .sort((a, b) => a.m.createdAt - b.m.createdAt)
    .map((x) => x.m)

  const newest = remotes.reduce<SceneBoardRemoteRow | null>(
    (best, r) =>
      !best || r.payload.updatedAtMs > best.payload.updatedAtMs ? r : best,
    null,
  )

  let selectedMovieId = local.selectedMovieId
  let creatorSelectedMovieId = local.creatorSelectedMovieId
  let watchMovieId = local.watchMovieId

  if (newest) {
    const s = newest.payload.state
    if (s.selectedMovieId && movies.some((m) => m.id === s.selectedMovieId)) {
      selectedMovieId = s.selectedMovieId
    }
    if (
      s.creatorSelectedMovieId &&
      movies.some((m) => m.id === s.creatorSelectedMovieId)
    ) {
      creatorSelectedMovieId = s.creatorSelectedMovieId
    }
    if (s.watchMovieId && movies.some((m) => m.id === s.watchMovieId)) {
      watchMovieId = s.watchMovieId
    }
  }

  return {
    movies,
    selectedMovieId: pickValidId(selectedMovieId, movies),
    creatorSelectedMovieId: pickValidId(creatorSelectedMovieId, movies),
    watchMovieId: pickValidId(watchMovieId, movies),
  }
}
