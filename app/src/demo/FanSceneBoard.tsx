import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useDemoSlot } from '../context/DemoSlotContext'
import {
  getFirstYoutubeVideoIdFromMovie,
  useMovies,
  type Movie,
} from '../context/SceneBoardContext'
import { sceneKeyHex } from '../stakeToCurate/sceneKey'
import {
  extractYoutubeVideoId,
  isProbablyYoutubeUrl,
  youtubeThumbnailUrl,
} from '../lib/youtubeUrl'
import { SceneCellForkTooltip } from './SceneCellForkTooltip'

type Props = {
  subheading?: string
}

type EditorTarget = { columnId: string; cellId: string; replace: boolean }

function moviePosterSrc(movie: Movie): string | null {
  const id = getFirstYoutubeVideoIdFromMovie(movie)
  return id ? youtubeThumbnailUrl(id) : null
}

export function FanSceneBoard({ subheading }: Props) {
  const {
    movies,
    selectedMovieId,
    setSelectedMovieId,
    getMovie,
    addTimeColumn,
    addAlternative,
    setCellUrl,
  } = useMovies()
  const {
    chainSynced,
    connected,
    busy,
    getSceneRow,
    ensureScenesRegisteredForMovie,
    refreshOnChain,
    onUnstake,
  } = useDemoSlot()

  const active = selectedMovieId ? getMovie(selectedMovieId) : null
  const movieId = active?.id

  const sceneMatrixDigest = useMemo(() => {
    if (!active) return ''
    return active.columns
      .map((c) =>
        c.cells.map((cell) => `${cell.id}:${cell.youtubeUrl ?? ''}`).join('|'),
      )
      .join('>')
  }, [active])

  useEffect(() => {
    if (!active || !connected) return
    void (async () => {
      try {
        await ensureScenesRegisteredForMovie(active)
        await refreshOnChain(active)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [
    active,
    connected,
    ensureScenesRegisteredForMovie,
    refreshOnChain,
    sceneMatrixDigest,
  ])

  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)

  const openAdd = (columnId: string, cellId: string) => {
    setEditor({ columnId, cellId, replace: false })
    setUrlDraft('')
    setUrlError(null)
  }

  const openReplace = (columnId: string, cellId: string, current: string) => {
    setEditor({ columnId, cellId, replace: true })
    setUrlDraft(current)
    setUrlError(null)
  }

  const closeEditor = () => {
    setEditor(null)
    setUrlDraft('')
    setUrlError(null)
  }

  const submitUrl = (e: FormEvent) => {
    e.preventDefault()
    if (!editor || !movieId) return
    const t = urlDraft.trim()
    if (!isProbablyYoutubeUrl(t)) {
      setUrlError('Use a full YouTube link (watch, Shorts, or youtu.be).')
      return
    }
    setCellUrl(movieId, editor.columnId, editor.cellId, t)
    closeEditor()
  }

  const clearCell = () => {
    if (!editor || !movieId) return
    setCellUrl(movieId, editor.columnId, editor.cellId, null)
    closeEditor()
  }

  return (
    <section className="panel fan-scene-board" aria-labelledby="scene-board-heading">
      <h2 id="scene-board-heading">Scene</h2>
      <p className="muted fan-scene-board-legend">
        Choose a movie, then edit its scene matrix. <strong>Columns</strong> are time;
        <strong>rows</strong> are alternate Shorts-style cuts. Each playable cell has its own
        on-chain <strong>Scene</strong> (rank / stake). The slot authority wallet registers
        scenes when URLs are saved. <strong>Watch</strong> picks among alternates per time
        column using only those scenes’ ranks. Hover a thumbnail for stats and unstake.
      </p>
      {subheading && <p className="muted fan-scene-board-sub">{subheading}</p>}

      {movies.length === 0 ? (
        <p className="muted">
          No movies yet. Create a concept on the <strong>Creator</strong> tab first.
        </p>
      ) : (
        <>
          <div className="movie-selector-bar" role="tablist" aria-label="Pick movie">
            {movies.map((m) => {
              const poster = moviePosterSrc(m)
              const activePick = m.id === selectedMovieId
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={activePick}
                  className={`movie-selector-item${activePick ? ' movie-selector-item-active' : ''}`}
                  onClick={() => setSelectedMovieId(m.id)}
                >
                  <span className="movie-selector-thumb-wrap">
                    {poster ? (
                      <img
                        className="movie-selector-thumb"
                        src={poster}
                        alt=""
                      />
                    ) : (
                      <span className="movie-selector-thumb-fallback" aria-hidden>
                        ▶
                      </span>
                    )}
                  </span>
                  <span className="movie-selector-title">
                    {m.title.trim() || 'Untitled'}
                  </span>
                </button>
              )
            })}
          </div>

          {!active ? (
            <p className="muted">Select a movie above.</p>
          ) : (
            <div className="scene-grid" role="region" aria-label="Scene matrix">
              {active.columns.map((col, colIndex) => (
                <div key={col.id} className="scene-column">
                  <div className="scene-column-head">Time {colIndex + 1}</div>
                  <div className="scene-column-cells">
                    {col.cells.map((cell, rowIndex) => {
                      const id = extractYoutubeVideoId(cell.youtubeUrl ?? '')
                      const skh =
                        movieId != null
                          ? sceneKeyHex(movieId, col.id, cell.id)
                          : ''
                      const row = skh ? getSceneRow(skh) : undefined
                      return (
                        <div key={cell.id} className="scene-cell-wrap">
                          <div className="scene-cell-meta">Alt {rowIndex + 1}</div>
                          {cell.youtubeUrl && id ? (
                            <div className="scene-cell-filled">
                              <SceneCellForkTooltip
                                timeLabel={`Time ${colIndex + 1}`}
                                altLabel={`Alt ${rowIndex + 1}`}
                                sceneKeyHex={skh}
                                chainSynced={chainSynced}
                                connected={connected}
                                busy={busy}
                                scene={row?.scene ?? null}
                                position={row?.position ?? null}
                                onUnstake={onUnstake}
                              >
                                <div className="scene-thumb-ring">
                                  <img
                                    className="scene-thumb"
                                    src={youtubeThumbnailUrl(id)}
                                    alt=""
                                    loading="lazy"
                                  />
                                </div>
                              </SceneCellForkTooltip>
                              <div className="scene-cell-actions">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() =>
                                    openReplace(col.id, cell.id, cell.youtubeUrl!)
                                  }
                                >
                                  Replace
                                </button>
                                <a
                                  className="scene-yt-link"
                                  href={cell.youtubeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open
                                </a>
                              </div>
                            </div>
                          ) : cell.youtubeUrl && !id ? (
                            <div className="scene-cell-filled scene-cell-badurl">
                              <p className="muted scene-cell-badurl-msg">
                                Unreadable YouTube link
                              </p>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  openReplace(col.id, cell.id, cell.youtubeUrl!)
                                }
                              >
                                Fix URL
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="scene-cell-placeholder"
                              onClick={() => openAdd(col.id, cell.id)}
                              aria-label={`Add YouTube scene, time ${colIndex + 1} alternative ${rowIndex + 1}`}
                            >
                              <span className="scene-cell-plus" aria-hidden>
                                +
                              </span>
                              <span className="scene-cell-placeholder-hint">
                                Add YouTube URL
                              </span>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost scene-add-alt"
                    onClick={() => addAlternative(active.id, col.id)}
                  >
                    + Alternative for this time
                  </button>
                </div>
              ))}
              <div className="scene-add-time-col">
                <button
                  type="button"
                  className="btn btn-secondary scene-add-time-btn"
                  onClick={() => addTimeColumn(active.id)}
                >
                  + Next moment in time
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {editor && (
        <div
          className="scene-url-modal-backdrop"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) closeEditor()
          }}
        >
          <div
            className="scene-url-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scene-url-modal-title"
          >
            <h3 id="scene-url-modal-title">
              {editor.replace ? 'Replace YouTube link' : 'Add YouTube link'}
            </h3>
            <form onSubmit={submitUrl} className="scene-url-form">
              <label className="field-label">
                YouTube URL
                <input
                  type="url"
                  className="text-input"
                  value={urlDraft}
                  onChange={(e) => {
                    setUrlDraft(e.target.value)
                    if (urlError) setUrlError(null)
                  }}
                  placeholder="https://www.youtube.com/watch?v=… or Shorts URL"
                  autoFocus
                />
              </label>
              {urlError && (
                <p className="field-error" role="alert">
                  {urlError}
                </p>
              )}
              <div className="scene-url-modal-actions">
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
                {editor.replace && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={clearCell}
                  >
                    Clear cell
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeEditor}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
