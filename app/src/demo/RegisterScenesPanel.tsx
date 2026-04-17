import { useCallback, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useDemoSlot } from '../context/DemoSlotContext'
import {
  getFirstYoutubeVideoIdFromMovie,
  useMovies,
  type Movie,
} from '../context/SceneBoardContext'
import { isPlatformOwner } from '../config/platformOwner'
import { youtubeThumbnailUrl } from '../lib/youtubeUrl'

function moviePosterSrc(movie: Movie): string | null {
  const id = getFirstYoutubeVideoIdFromMovie(movie)
  return id ? youtubeThumbnailUrl(id) : null
}

export function RegisterScenesPanel() {
  const { publicKey } = useWallet()
  const {
    movies,
    selectedMovieId,
    setSelectedMovieId,
    getMovie,
  } = useMovies()
  const {
    busy,
    slotAuthority,
    ensureScenesRegisteredForMovie,
    append,
  } = useDemoSlot()

  const active = selectedMovieId ? getMovie(selectedMovieId) : null
  const slotAuthMatches =
    publicKey != null &&
    slotAuthority != null &&
    publicKey.equals(slotAuthority)
  const showPanel =
    isPlatformOwner(publicKey) && slotAuthMatches && movies.length > 0

  const [registerBusy, setRegisterBusy] = useState(false)

  const onRegisterMissingScenes = useCallback(async () => {
    if (!active) return
    setRegisterBusy(true)
    try {
      await ensureScenesRegisteredForMovie(active)
    } catch (e) {
      console.error(e)
      append(
        `ERR: register scenes — ${e instanceof Error ? e.message : String(e)}`,
      )
    } finally {
      setRegisterBusy(false)
    }
  }, [active, append, ensureScenesRegisteredForMovie])

  if (!showPanel) return null

  return (
    <section className="panel register-scenes-panel" aria-labelledby="register-scenes-heading">
      <h2 id="register-scenes-heading">Register scenes on-chain</h2>
      <p className="muted">
        Pick a movie, then register missing <strong>Scene</strong> PDAs for playable
        cells (batch sign).
      </p>
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
      {active ? (
        <div className="fan-scene-register-row">
          <button
            type="button"
            className="btn btn-primary fan-scene-register-btn"
            disabled={busy || registerBusy}
            onClick={() => void onRegisterMissingScenes()}
          >
            {registerBusy ? 'Signing…' : 'Register missing scenes on-chain'}
          </button>
          <span className="muted fan-scene-register-hint">
            Creates a Scene account for each cell that has a YouTube URL but is not on
            devnet yet. Requires the program in your build to match{' '}
            <code className="pid">VITE_STAKE_TO_CURATE_PROGRAM_ID</code>.
          </span>
        </div>
      ) : (
        <p className="muted">Select a movie above.</p>
      )}
    </section>
  )
}
