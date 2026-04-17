import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useDemoSlot } from '../context/DemoSlotContext'
import { useMovies } from '../context/SceneBoardContext'
import { sceneKeyHex } from '../stakeToCurate/sceneKey'
import {
  extractYoutubeVideoId,
  isProbablyYoutubeUrl,
  youtubeThumbnailUrl,
} from '../lib/youtubeUrl'
import { SceneCellForkTooltip } from './SceneCellForkTooltip'

type EditorTarget = { columnId: string; cellId: string; replace: boolean }

export function FanSceneBoard() {
  const {
    movies,
    selectedMovieId,
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
        await refreshOnChain(active)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [active, connected, refreshOnChain, sceneMatrixDigest])

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
    <section
      className="panel fan-scene-board"
      aria-labelledby="scene-board-heading"
    >
      <h2 id="scene-board-heading" className="sr-only">
        Scene matrix
      </h2>

      {movies.length === 0 ? (
        <p className="muted">
          No movies yet. Create a concept in <strong>Movies</strong> above.
        </p>
      ) : !active ? (
        <p className="muted">
          Select a movie in <strong>Movies</strong> above to edit its scene matrix.
        </p>
      ) : (
        <>
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
