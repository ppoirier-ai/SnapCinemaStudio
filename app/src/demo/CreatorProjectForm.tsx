import { useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useDemoSlot } from '../context/DemoSlotContext'
import { useMovies, type Movie } from '../context/SceneBoardContext'

function ConceptEditor({
  movie,
  wallet,
}: {
  movie: Movie
  wallet: string
}) {
  const { setToast } = useDemoSlot()
  const {
    setProjectTitle,
    setProjectDescription,
    saveProjectConcept,
    unlockProjectConcept,
  } = useMovies()

  const onSave = () => {
    saveProjectConcept(movie.id, wallet)
    setToast('Project concept saved (stored in this browser).')
  }

  const locked = movie.projectConceptLocked

  return (
    <div className="creator-concept-editor nested-concept-panel">
      <h3 className="creator-concept-editor-title">
        Edit: {movie.title.trim() || 'Untitled'}
      </h3>
      {locked ? (
        <div className="creator-project-locked">
          <div className="creator-project-locked-block">
            <span className="field-label">Title</span>
            <p className="creator-project-locked-title">
              {movie.title.trim() ? (
                movie.title
              ) : (
                <span className="muted empty-hint">No title</span>
              )}
            </p>
          </div>
          <div className="creator-project-locked-block">
            <span className="field-label">Description</span>
            <div className="creator-project-locked-description">
              {movie.description.trim() ? (
                movie.description.split('\n').map((line, i) => (
                  <p key={i} className="creator-project-locked-desc-line">
                    {line || '\u00a0'}
                  </p>
                ))
              ) : (
                <p className="muted empty-hint">No description</p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => unlockProjectConcept(movie.id, wallet)}
          >
            Edit concept
          </button>
        </div>
      ) : (
        <div className="creator-project-fields">
          <label className="field-label">
            Title
            <input
              type="text"
              className="text-input creator-project-input"
              value={movie.title}
              onChange={(e) =>
                setProjectTitle(movie.id, wallet, e.target.value)
              }
              placeholder="Working title"
              maxLength={120}
            />
          </label>
          <label className="field-label">
            Description
            <textarea
              className="text-input creator-project-textarea"
              value={movie.description}
              onChange={(e) =>
                setProjectDescription(movie.id, wallet, e.target.value)
              }
              placeholder="Logline, tone, audience — whatever helps reviewers understand the project."
              rows={5}
              maxLength={4000}
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={onSave}>
            Save concept
          </button>
        </div>
      )}
    </div>
  )
}

export function CreatorProjectForm() {
  const { publicKey, connected } = useWallet()
  const wallet = publicKey?.toBase58() ?? null
  const {
    movies,
    moviesByWallet,
    createMovie,
    creatorSelectedMovieId,
    setCreatorSelectedMovieId,
    selectedMovieId,
    setSelectedMovieId,
    getMovie,
  } = useMovies()

  const mine = useMemo(
    () => (wallet ? moviesByWallet(wallet) : []),
    [wallet, moviesByWallet],
  )

  const myMovieIds = useMemo(() => {
    if (!wallet) return new Set<string>()
    return new Set(mine.map((m) => m.id))
  }, [wallet, mine])

  const selected =
    creatorSelectedMovieId && wallet
      ? getMovie(creatorSelectedMovieId)
      : undefined
  const selectedMine =
    selected && wallet && selected.creatorWallet === wallet

  return (
    <div className="creator-project-form">
      <p className="muted">
        Pick any movie to work on scene cuts in <strong>Scene management</strong> below.
        Title and description can only be changed by the wallet that created that movie.
      </p>

      {!connected || !wallet ? (
        <p className="muted">Connect your wallet to create and edit concepts.</p>
      ) : (
        <>
          <div className="creator-movie-list">
            <button
              type="button"
              className="btn btn-secondary creator-movie-new"
              onClick={() => createMovie(wallet)}
            >
              + New movie concept
            </button>
            {movies.map((m) => {
              const isMine = myMovieIds.has(m.id)
              const active = selectedMovieId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`creator-movie-pick${active ? ' creator-movie-pick-active' : ''}${isMine ? ' creator-movie-pick-own' : ''}`}
                  onClick={() => {
                    setCreatorSelectedMovieId(m.id)
                    setSelectedMovieId(m.id)
                  }}
                >
                  {m.title.trim() || 'Untitled'}
                  {isMine ? (
                    <span className="creator-movie-pick-own-mark" aria-hidden>
                      {' '}
                      · yours
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {mine.length === 0 && (
            <p className="muted creator-movie-empty">
              You have not created a concept yet — use <strong>+ New movie concept</strong>{' '}
              to add a title and description, or pick someone else&apos;s movie to contribute
              scenes.
            </p>
          )}

          {selectedMine && selected && <ConceptEditor movie={selected} wallet={wallet} />}

          {creatorSelectedMovieId && selected && !selectedMine && (
            <p className="muted creator-community-hint">
              Title and description are locked to the creator&apos;s wallet. You can still add
              or edit scene cuts in Scene management.
            </p>
          )}
        </>
      )}
    </div>
  )
}
