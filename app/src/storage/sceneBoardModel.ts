export type SceneCell = {
  id: string
  youtubeUrl: string | null
  /** Stake weight for weighted alternative selection (stringified bigint in JSON). */
  rank?: string
  /** Set after contributor registers the Scene PDA for this cell (matches on-chain `reserved_by`). */
  reservedWallet?: string | null
}
export type SceneColumn = { id: string; cells: SceneCell[] }

export type Movie = {
  id: string
  creatorWallet: string
  title: string
  description: string
  projectConceptLocked: boolean
  columns: SceneColumn[]
  createdAt: number
}

export type MoviesUIState = {
  movies: Movie[]
  /** Scenes tab: which movie’s matrix is shown */
  selectedMovieId: string | null
  /** Creator tab: which concept is being edited */
  creatorSelectedMovieId: string | null
  /** Watch page: main embed + highlight in list */
  watchMovieId: string | null
}
