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
    moviesByWallet,
    createMovie,
    creatorSelectedMovieId,
    setCreatorSelectedMovieId,
    setSelectedMovieId,
    getMovie,
  } = useMovies()

  const mine = useMemo(
    () => (wallet ? moviesByWallet(wallet) : []),
    [wallet, moviesByWallet],
  )

  const selected =
    creatorSelectedMovieId && wallet
      ? getMovie(creatorSelectedMovieId)
      : undefined
  const selectedMine =
    selected && wallet && selected.creatorWallet === wallet

  return (
    <section className="panel" aria-labelledby="creator-concept-heading">
      <h2 id="creator-concept-heading">Your movie concepts</h2>
      <p className="muted">
        Only the wallet that created a concept can change its title and description.
        Scene cuts for each movie are edited in <strong>Scene management</strong> below.
      </p>

      {!connected || !wallet ? (
        <p className="muted">Connect your wallet to create and edit concepts.</p>
      ) : (
        <>
          <div className="creator-movie-list">
            {mine.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`creator-movie-pick${creatorSelectedMovieId === m.id ? ' creator-movie-pick-active' : ''}`}
                onClick={() => {
                  setCreatorSelectedMovieId(m.id)
                  setSelectedMovieId(m.id)
                }}
              >
                {m.title.trim() || 'Untitled'}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-secondary creator-movie-new"
              onClick={() => createMovie(wallet)}
            >
              + New movie concept
            </button>
          </div>

          {mine.length === 0 && (
            <p className="muted creator-movie-empty">
              No concepts yet — create one to add a title and description.
            </p>
          )}

          {selectedMine && <ConceptEditor movie={selected} wallet={wallet} />}

          {creatorSelectedMovieId && !selectedMine && (
            <p className="muted">Select one of your concepts above.</p>
          )}
        </>
      )}
    </section>
  )
}
