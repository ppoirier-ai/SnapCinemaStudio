import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { extractYoutubeVideoId } from '../lib/youtubeUrl'
import {
  loadRemoteSceneBoardRows,
  mergeRemoteSceneBoardRows,
  pushSceneBoardForWallet,
  sceneBoardCloudConfigured,
  sceneBoardPublisherWallet,
} from '../storage/sceneBoardCloud'
import { readLocalMeta, writeLocalMeta } from '../storage/sceneBoardMeta'
import type { Movie, MoviesUIState, SceneColumn } from '../storage/sceneBoardModel'

export type { Movie, MoviesUIState, SceneColumn, SceneCell } from '../storage/sceneBoardModel'

const STORAGE_KEY = 'snapcinema-movies-v2'
const LEGACY_KEY = 'snapcinema-scene-board-v1'

function newId() {
  return crypto.randomUUID()
}

function defaultColumns(): SceneColumn[] {
  return [
    {
      id: newId(),
      cells: [{ id: newId(), youtubeUrl: null }],
    },
  ]
}

function normalizeColumns(raw: unknown): SceneColumn[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultColumns()
  return raw.map((col: unknown) => {
    const c = col as { id?: string; cells?: unknown }
    return {
      id: typeof c.id === 'string' ? c.id : newId(),
      cells: Array.isArray(c.cells)
        ? c.cells.map((cell: unknown) => {
            const x = cell as {
              id?: string
              youtubeUrl?: string | null
              rank?: string
            }
            return {
              id: typeof x.id === 'string' ? x.id : newId(),
              youtubeUrl:
                typeof x.youtubeUrl === 'string' ? x.youtubeUrl : null,
              rank: typeof x.rank === 'string' ? x.rank : undefined,
            }
          })
        : [{ id: newId(), youtubeUrl: null }],
    }
  })
}

function normalizeMovie(raw: unknown): Movie | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Partial<Movie>
  if (typeof m.id !== 'string' || typeof m.creatorWallet !== 'string')
    return null
  return {
    id: m.id,
    creatorWallet: m.creatorWallet,
    title: typeof m.title === 'string' ? m.title : '',
    description: typeof m.description === 'string' ? m.description : '',
    projectConceptLocked: !!m.projectConceptLocked,
    columns: normalizeColumns(m.columns),
    createdAt: typeof m.createdAt === 'number' ? m.createdAt : Date.now(),
  }
}

function loadV2(): MoviesUIState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<MoviesUIState>
    const movies = Array.isArray(p.movies)
      ? (p.movies.map(normalizeMovie).filter(Boolean) as Movie[])
      : []
    return {
      movies,
      selectedMovieId:
        typeof p.selectedMovieId === 'string' ? p.selectedMovieId : null,
      creatorSelectedMovieId:
        typeof p.creatorSelectedMovieId === 'string'
          ? p.creatorSelectedMovieId
          : null,
      watchMovieId:
        typeof p.watchMovieId === 'string' ? p.watchMovieId : null,
    }
  } catch {
    return null
  }
}

type LegacyBoard = {
  projectTitle?: string
  projectDescription?: string
  projectConceptLocked?: boolean
  columns?: unknown
}

function readLegacyBoard(): LegacyBoard | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LegacyBoard
  } catch {
    return null
  }
}

function legacyToMovie(legacy: LegacyBoard, creatorWallet: string): Movie {
  return {
    id: newId(),
    creatorWallet,
    title: typeof legacy.projectTitle === 'string' ? legacy.projectTitle : '',
    description:
      typeof legacy.projectDescription === 'string'
        ? legacy.projectDescription
        : '',
    projectConceptLocked: !!legacy.projectConceptLocked,
    columns: normalizeColumns(legacy.columns),
    createdAt: Date.now(),
  }
}

function persist(state: MoviesUIState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    writeLocalMeta({ lastLocalWriteMs: Date.now() })
  } catch {
    /* quota */
  }
}

function pickValidId(
  preferred: string | null,
  movies: Movie[],
): string | null {
  if (preferred && movies.some((m) => m.id === preferred)) return preferred
  return movies[0]?.id ?? null
}

export function getFirstYoutubeVideoIdFromMovie(movie: Movie): string | null {
  for (const col of movie.columns) {
    for (const cell of col.cells) {
      if (!cell.youtubeUrl) continue
      const id = extractYoutubeVideoId(cell.youtubeUrl)
      if (id) return id
    }
  }
  return null
}

type MoviesContextValue = {
  movies: Movie[]
  selectedMovieId: string | null
  setSelectedMovieId: (id: string | null) => void
  creatorSelectedMovieId: string | null
  setCreatorSelectedMovieId: (id: string | null) => void
  watchMovieId: string | null
  setWatchMovieId: (id: string | null) => void
  createMovie: (creatorWallet: string) => string
  getMovie: (id: string) => Movie | undefined
  moviesByWallet: (wallet: string) => Movie[]
  setProjectTitle: (movieId: string, wallet: string | null, title: string) => void
  setProjectDescription: (
    movieId: string,
    wallet: string | null,
    description: string,
  ) => void
  saveProjectConcept: (movieId: string, wallet: string | null) => void
  unlockProjectConcept: (movieId: string, wallet: string | null) => void
  addTimeColumn: (movieId: string) => void
  addAlternative: (movieId: string, columnId: string) => void
  setCellUrl: (
    movieId: string,
    columnId: string,
    cellId: string,
    url: string | null,
  ) => void
}

const MoviesContext = createContext<MoviesContextValue | null>(null)

export function SceneBoardProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage } = useWallet()
  const wallet = publicKey?.toBase58() ?? null
  const cloudHydratedKey = useRef<string | null>(null)
  const cloudPushTimer = useRef<number | null>(null)

  const [state, setState] = useState<MoviesUIState>(() => {
    const v2 = loadV2()
    if (v2) {
      const { movies } = v2
      return {
        movies,
        selectedMovieId: pickValidId(v2.selectedMovieId, movies),
        creatorSelectedMovieId: pickValidId(v2.creatorSelectedMovieId, movies),
        watchMovieId: pickValidId(v2.watchMovieId, movies),
      }
    }
    return {
      movies: [],
      selectedMovieId: null,
      creatorSelectedMovieId: null,
      watchMovieId: null,
    }
  })

  const [legacyDone, setLegacyDone] = useState(false)

  useEffect(() => {
    if (!sceneBoardCloudConfigured() || !wallet) return
    const publisher = sceneBoardPublisherWallet()
    const targets: string[] = []
    if (publisher) targets.push(publisher)
    if (!targets.includes(wallet)) targets.push(wallet)
    const key = targets.sort().join('|')
    if (cloudHydratedKey.current === key) return
    cloudHydratedKey.current = key

    let cancelled = false
    void (async () => {
      const remotes = await loadRemoteSceneBoardRows(targets)
      if (cancelled || remotes.length === 0) return
      setState((s) => {
        const meta = readLocalMeta()
        const merged = mergeRemoteSceneBoardRows(
          s,
          meta.lastLocalWriteMs,
          remotes,
        )
        persist(merged)
        return merged
      })
    })()
    return () => {
      cancelled = true
    }
  }, [wallet])

  useEffect(() => {
    if (!wallet || legacyDone) return
    const legacy = readLegacyBoard()
    if (!legacy?.columns || !Array.isArray(legacy.columns)) {
      setLegacyDone(true)
      return
    }
    setState((s) => {
      if (s.movies.length > 0) return s
      const m = legacyToMovie(legacy, wallet)
      try {
        localStorage.removeItem(LEGACY_KEY)
      } catch {
        /* ignore */
      }
      const next: MoviesUIState = {
        movies: [m],
        selectedMovieId: m.id,
        creatorSelectedMovieId: m.id,
        watchMovieId: m.id,
      }
      persist(next)
      return next
    })
    setLegacyDone(true)
  }, [wallet, legacyDone])

  useEffect(() => {
    const t = window.setTimeout(() => persist(state), 250)
    return () => window.clearTimeout(t)
  }, [state])

  useEffect(() => {
    if (!sceneBoardCloudConfigured() || !wallet) return
    if (cloudPushTimer.current) window.clearTimeout(cloudPushTimer.current)
    cloudPushTimer.current = window.setTimeout(() => {
      cloudPushTimer.current = null
      void pushSceneBoardForWallet(wallet, state, signMessage)
    }, 2500)
    return () => {
      if (cloudPushTimer.current) window.clearTimeout(cloudPushTimer.current)
    }
  }, [state, wallet, signMessage])

  const movieIdsKey = useMemo(
    () => state.movies.map((m) => m.id).join('|'),
    [state.movies],
  )

  useEffect(() => {
    setState((s) => {
      const { movies } = s
      if (movies.length === 0) {
        if (
          s.selectedMovieId === null &&
          s.creatorSelectedMovieId === null &&
          s.watchMovieId === null
        )
          return s
        return {
          ...s,
          selectedMovieId: null,
          creatorSelectedMovieId: null,
          watchMovieId: null,
        }
      }
      const sel = pickValidId(s.selectedMovieId, movies)
      const cre = pickValidId(s.creatorSelectedMovieId, movies)
      const wat = pickValidId(s.watchMovieId, movies)
      if (
        sel === s.selectedMovieId &&
        cre === s.creatorSelectedMovieId &&
        wat === s.watchMovieId
      )
        return s
      return {
        ...s,
        selectedMovieId: sel,
        creatorSelectedMovieId: cre,
        watchMovieId: wat,
      }
    })
  }, [movieIdsKey])

  const setSelectedMovieId = useCallback((id: string | null) => {
    setState((s) => ({
      ...s,
      selectedMovieId:
        id === null || s.movies.some((m) => m.id === id) ? id : s.selectedMovieId,
    }))
  }, [])

  const setCreatorSelectedMovieId = useCallback((id: string | null) => {
    setState((s) => ({
      ...s,
      creatorSelectedMovieId:
        id === null || s.movies.some((m) => m.id === id)
          ? id
          : s.creatorSelectedMovieId,
    }))
  }, [])

  const setWatchMovieId = useCallback((id: string | null) => {
    setState((s) => ({
      ...s,
      watchMovieId:
        id === null || s.movies.some((m) => m.id === id) ? id : s.watchMovieId,
    }))
  }, [])

  const createMovie = useCallback((creatorWallet: string) => {
    const m: Movie = {
      id: newId(),
      creatorWallet,
      title: '',
      description: '',
      projectConceptLocked: false,
      columns: defaultColumns(),
      createdAt: Date.now(),
    }
    setState((s) => ({
      movies: [...s.movies, m],
      selectedMovieId: s.selectedMovieId ?? m.id,
      creatorSelectedMovieId: m.id,
      watchMovieId: s.watchMovieId ?? m.id,
    }))
    return m.id
  }, [])

  const getMovie = useCallback(
    (id: string) => state.movies.find((m) => m.id === id),
    [state.movies],
  )

  const moviesByWallet = useCallback(
    (w: string) => state.movies.filter((m) => m.creatorWallet === w),
    [state.movies],
  )

  const mutateMovie = useCallback(
    (movieId: string, wallet: string | null, fn: (m: Movie) => Movie) => {
      if (!wallet) return
      setState((s) => ({
        ...s,
        movies: s.movies.map((m) => {
          if (m.id !== movieId || m.creatorWallet !== wallet) return m
          return fn(m)
        }),
      }))
    },
    [],
  )

  const setProjectTitle = useCallback(
    (movieId: string, w: string | null, title: string) => {
      mutateMovie(movieId, w, (m) => ({ ...m, title }))
    },
    [mutateMovie],
  )

  const setProjectDescription = useCallback(
    (movieId: string, w: string | null, description: string) => {
      mutateMovie(movieId, w, (m) => ({ ...m, description }))
    },
    [mutateMovie],
  )

  const saveProjectConcept = useCallback((movieId: string, w: string | null) => {
    if (!w) return
    setState((s) => {
      const next = {
        ...s,
        movies: s.movies.map((m) =>
          m.id === movieId && m.creatorWallet === w
            ? { ...m, projectConceptLocked: true }
            : m,
        ),
      }
      persist(next)
      return next
    })
  }, [])

  const unlockProjectConcept = useCallback(
    (movieId: string, w: string | null) => {
      mutateMovie(movieId, w, (m) => ({ ...m, projectConceptLocked: false }))
    },
    [mutateMovie],
  )

  const patchMovieColumns = useCallback(
    (movieId: string, fn: (cols: SceneColumn[]) => SceneColumn[]) => {
      setState((s) => ({
        ...s,
        movies: s.movies.map((m) =>
          m.id === movieId ? { ...m, columns: fn(m.columns) } : m,
        ),
      }))
    },
    [],
  )

  const addTimeColumn = useCallback(
    (movieId: string) => {
      patchMovieColumns(movieId, (cols) => [
        ...cols,
        { id: newId(), cells: [{ id: newId(), youtubeUrl: null }] },
      ])
    },
    [patchMovieColumns],
  )

  const addAlternative = useCallback(
    (movieId: string, columnId: string) => {
      patchMovieColumns(movieId, (cols) =>
        cols.map((col) =>
          col.id === columnId
            ? {
                ...col,
                cells: [...col.cells, { id: newId(), youtubeUrl: null }],
              }
            : col,
        ),
      )
    },
    [patchMovieColumns],
  )

  const setCellUrl = useCallback(
    (movieId: string, columnId: string, cellId: string, url: string | null) => {
      patchMovieColumns(movieId, (cols) =>
        cols.map((col) =>
          col.id !== columnId
            ? col
            : {
                ...col,
                cells: col.cells.map((c) =>
                  c.id === cellId ? { ...c, youtubeUrl: url } : c,
                ),
              },
        ),
      )
    },
    [patchMovieColumns],
  )

  const value = useMemo(
    () => ({
      movies: state.movies,
      selectedMovieId: state.selectedMovieId,
      setSelectedMovieId,
      creatorSelectedMovieId: state.creatorSelectedMovieId,
      setCreatorSelectedMovieId,
      watchMovieId: state.watchMovieId,
      setWatchMovieId,
      createMovie,
      getMovie,
      moviesByWallet,
      setProjectTitle,
      setProjectDescription,
      saveProjectConcept,
      unlockProjectConcept,
      addTimeColumn,
      addAlternative,
      setCellUrl,
    }),
    [
      state.movies,
      state.selectedMovieId,
      state.creatorSelectedMovieId,
      state.watchMovieId,
      setSelectedMovieId,
      setCreatorSelectedMovieId,
      setWatchMovieId,
      createMovie,
      getMovie,
      moviesByWallet,
      setProjectTitle,
      setProjectDescription,
      saveProjectConcept,
      unlockProjectConcept,
      addTimeColumn,
      addAlternative,
      setCellUrl,
    ],
  )

  return (
    <MoviesContext.Provider value={value}>{children}</MoviesContext.Provider>
  )
}

export function useMovies() {
  const ctx = useContext(MoviesContext)
  if (!ctx) throw new Error('useMovies must be used within SceneBoardProvider')
  return ctx
}

/** @deprecated use useMovies */
export const useSceneBoard = useMovies
