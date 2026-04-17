import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
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
  const { publicKey } = useWallet()
  const walletAddr = publicKey?.toBase58() ?? null
  const {
    movies,
    selectedMovieId,
    getMovie,
    addTimeColumn,
    addAlternative,
    setCellUrl,
    setCellReservedWallet,
  } = useMovies()
  const {
    chainSynced,
    connected,
    busy,
    getSceneRow,
    refreshOnChain,
    onUnstake,
    registerSceneForCell,
  } = useDemoSlot()

  const active = selectedMovieId ? getMovie(selectedMovieId) : null
  const movieId = active?.id

  const sceneMatrixDigest = useMemo(() => {
    if (!active) return ''
    return active.columns
      .map((c) =>
        c.cells
          .map(
            (cell) =>
              `${cell.id}:${cell.youtubeUrl ?? ''}:${cell.reservedWallet ?? ''}`,
          )
          .join('|'),
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
  const [reserveBusy, setReserveBusy] = useState(false)

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

  const isUrlFrozen = (
    cell: { youtubeUrl: string | null },
    row: ReturnType<typeof getSceneRow>,
  ) => {
    const hasUrl =
      !!cell.youtubeUrl && !!extractYoutubeVideoId(cell.youtubeUrl ?? '')
    return !!(hasUrl && row?.scene)
  }

  const canSetUrlForCell = (
    cell: { reservedWallet?: string | null },
    row: ReturnType<typeof getSceneRow>,
  ) => {
    if (!publicKey) return false
    if (row?.scene?.reservedBy) {
      const rb = row.scene.reservedBy
      if (rb.equals(PublicKey.default)) return true
      return rb.equals(publicKey)
    }
    if (cell.reservedWallet) return cell.reservedWallet === walletAddr
    return true
  }

  const submitUrl = async (e: FormEvent) => {
    e.preventDefault()
    if (!editor || !movieId || !active) return
    const t = urlDraft.trim()
    if (!isProbablyYoutubeUrl(t)) {
      setUrlError('Use a full YouTube link (watch, Shorts, or youtu.be).')
      return
    }
    if (!connected || !publicKey) {
      setUrlError('Connect your wallet to save.')
      return
    }

    const skh = sceneKeyHex(movieId, editor.columnId, editor.cellId)
    let row = getSceneRow(skh)

    if (!row?.scene) {
      setReserveBusy(true)
      try {
        await registerSceneForCell(active, editor.columnId, editor.cellId)
        setCellReservedWallet(
          movieId,
          editor.columnId,
          editor.cellId,
          publicKey.toBase58(),
        )
        await refreshOnChain(active, { log: false })
        row = getSceneRow(skh)
      } catch (err) {
        console.error(err)
        setUrlError(
          err instanceof Error ? err.message : 'Could not register scene slot',
        )
        setReserveBusy(false)
        return
      } finally {
        setReserveBusy(false)
      }
    }

    row = getSceneRow(skh)
    const editCell = active.columns
      .find((c) => c.id === editor.columnId)
      ?.cells.find((c) => c.id === editor.cellId)
    if (!canSetUrlForCell(editCell ?? {}, row)) {
      setUrlError('Only the wallet that reserved this slot can set the URL.')
      return
    }

    setCellUrl(movieId, editor.columnId, editor.cellId, t)
    closeEditor()
  }

  const clearCell = () => {
    if (!editor || !movieId || !active) return
    const skh = sceneKeyHex(movieId, editor.columnId, editor.cellId)
    const row = getSceneRow(skh)
    const cell = active.columns
      .flatMap((c) =>
        c.id === editor.columnId
          ? c.cells.filter((ce) => ce.id === editor.cellId)
          : [],
      )[0]
    if (cell && isUrlFrozen(cell, row)) return
    setCellUrl(movieId, editor.columnId, editor.cellId, null)
    closeEditor()
  }

  const handleAddTime = async () => {
    if (!active || !connected || !publicKey) return
    const { columnId, cellId } = addTimeColumn(active.id)
    setReserveBusy(true)
    try {
      await registerSceneForCell(active, columnId, cellId)
      setCellReservedWallet(active.id, columnId, cellId, publicKey.toBase58())
      await refreshOnChain(active, { log: false })
    } catch (e) {
      console.error(e)
    } finally {
      setReserveBusy(false)
    }
  }

  const handleAddAlt = async (columnId: string) => {
    if (!active || !connected || !publicKey) return
    const { cellId } = addAlternative(active.id, columnId)
    setReserveBusy(true)
    try {
      await registerSceneForCell(active, columnId, cellId)
      setCellReservedWallet(active.id, columnId, cellId, publicKey.toBase58())
      await refreshOnChain(active, { log: false })
    } catch (e) {
      console.error(e)
    } finally {
      setReserveBusy(false)
    }
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
          Select a movie in <strong>Movies</strong> above to edit its scene
          matrix.
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
                    const frozen = isUrlFrozen(cell, row)
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
                              {!frozen && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() =>
                                    openReplace(col.id, cell.id, cell.youtubeUrl!)
                                  }
                                >
                                  Replace
                                </button>
                              )}
                              {frozen && (
                                <span className="muted scene-cell-locked-hint">
                                  Locked on-chain
                                </span>
                              )}
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
                            {!frozen && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  openReplace(col.id, cell.id, cell.youtubeUrl!)
                                }
                              >
                                Fix URL
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="scene-cell-placeholder"
                            disabled={reserveBusy || !connected}
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
                  disabled={reserveBusy || !connected}
                  onClick={() => void handleAddAlt(col.id)}
                >
                  + Alternative for this time
                </button>
              </div>
            ))}
            <div className="scene-add-time-col">
              <button
                type="button"
                className="btn btn-secondary scene-add-time-btn"
                disabled={reserveBusy || !connected}
                onClick={() => void handleAddTime()}
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
            <p className="muted scene-url-modal-hint">
              First save registers the scene on-chain (wallet pays rent). URLs
              cannot be changed after they are saved while the scene exists
              on-chain.
            </p>
            <form onSubmit={(e) => void submitUrl(e)} className="scene-url-form">
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || reserveBusy}
                >
                  {reserveBusy ? 'Signing…' : 'Save'}
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
