import { useDemoSlot } from '../context/DemoSlotContext'
import {
  getFirstYoutubeVideoIdFromMovie,
  useMovies,
  type Movie,
} from '../context/SceneBoardContext'
import { FAN_REACTION_LAMPORTS } from '../demo/constants'
import { IconFlag, IconThumbDown, IconThumbUp } from '../components/ReactionIcons'
import { youtubeEmbedSrc } from '../lib/youtubeEmbed'
import { youtubeThumbnailUrl } from '../lib/youtubeUrl'

function posterForMovie(m: Movie): string | null {
  const id = getFirstYoutubeVideoIdFromMovie(m)
  return id ? youtubeThumbnailUrl(id) : null
}

export function WatchPage() {
  const envEmbed = youtubeEmbedSrc()
  const { movies, watchMovieId, setWatchMovieId, getMovie } = useMovies()
  const {
    playback,
    busy,
    connected,
    onStakeUp,
    onStakeDown,
    setToast,
    append,
  } = useDemoSlot()

  const playingMovie =
    (watchMovieId ? getMovie(watchMovieId) : null) ?? movies[0] ?? null

  const fromMovieVid = playingMovie
    ? getFirstYoutubeVideoIdFromMovie(playingMovie)
    : null
  const embedSrc = fromMovieVid
    ? `https://www.youtube.com/embed/${fromMovieVid}?rel=0`
    : envEmbed

  const thumbsDisabled = !connected || busy || playback === null
  const flagDisabled = !connected || busy

  const onThumbUp = () => {
    if (playback === null) return
    void onStakeUp(playback, FAN_REACTION_LAMPORTS)
  }

  const onThumbDown = () => {
    if (playback === null) return
    void onStakeDown(playback, FAN_REACTION_LAMPORTS)
  }

  const onFlag = () => {
    setToast(
      'Flag recorded for this demo. On-chain reporting can be added in a later version.',
    )
    append('Flag: UI-only signal (no chain tx)')
  }

  return (
    <main className="studio watch-page">
      <div className="watch-short-shell">
        <div className="watch-short-frame">
          {embedSrc ? (
            <iframe
              title={
                playingMovie?.title.trim()
                  ? `${playingMovie.title} — SnapCinema`
                  : 'SnapCinema demo short'
              }
              src={embedSrc}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="watch-short-placeholder">
              <p>
                Add YouTube scenes to a movie on the <strong>Scenes</strong> tab, pick
                it below, or set <code>VITE_YOUTUBE_SHORT_ID</code> /{' '}
                <code>VITE_YOUTUBE_EMBED_URL</code> in <code>.env</code>.
              </p>
            </div>
          )}
        </div>
        {playingMovie && (
          <p className="muted watch-now-playing-title">
            Now showing:{' '}
            <strong>{playingMovie.title.trim() || 'Untitled'}</strong>
          </p>
        )}
        {playback !== null && (
          <p className="muted watch-curate-hint">
            On-chain sample: curating <strong>version {playback}</strong> (thumbs use
            0.01 SOL on devnet).
          </p>
        )}
        {playback === null && connected && (
          <p className="muted watch-curate-hint">
            Initialize the demo slot under <strong>Studio demo</strong> → Admin so
            two versions exist; then a sampled version appears here for reactions.
          </p>
        )}
        <div className="watch-reaction-bar" role="group" aria-label="Curate clip">
          <button
            type="button"
            className="watch-icon-btn watch-icon-btn-up"
            disabled={thumbsDisabled}
            onClick={onThumbUp}
            aria-label="Thumbs up"
          >
            <IconThumbUp className="watch-icon-svg" />
          </button>
          <button
            type="button"
            className="watch-icon-btn watch-icon-btn-down"
            disabled={thumbsDisabled}
            onClick={onThumbDown}
            aria-label="Thumbs down"
          >
            <IconThumbDown className="watch-icon-svg" />
          </button>
          <button
            type="button"
            className="watch-icon-btn watch-icon-btn-flag"
            disabled={flagDisabled}
            onClick={onFlag}
            aria-label="Flag"
          >
            <IconFlag className="watch-icon-svg" />
          </button>
        </div>
      </div>

      <section className="watch-movie-library" aria-labelledby="watch-library-heading">
        <h2 id="watch-library-heading" className="watch-library-title">
          Movies to watch
        </h2>
        {movies.length === 0 ? (
          <p className="muted watch-library-empty">
            No movies in this browser yet. Create a concept under Studio → Creator and
            add scenes under Scenes.
          </p>
        ) : (
          <ul className="watch-movie-strip">
            {movies.map((m) => {
              const poster = posterForMovie(m)
              const desc =
                m.description.trim() ||
                'No description yet — creator can add one on the Creator tab.'
              const isPlaying = playingMovie?.id === m.id
              return (
                <li key={m.id} className="watch-movie-strip-item">
                  <button
                    type="button"
                    className={`watch-movie-card${isPlaying ? ' watch-movie-card-playing' : ''}`}
                    onClick={() => setWatchMovieId(m.id)}
                    aria-pressed={isPlaying}
                  >
                    <span className="watch-movie-card-visual">
                      {poster ? (
                        <img
                          className="watch-movie-card-thumb"
                          src={poster}
                          alt=""
                        />
                      ) : (
                        <span className="watch-movie-card-thumb-fallback" aria-hidden>
                          ▶
                        </span>
                      )}
                      <span className="watch-movie-card-tooltip" role="tooltip">
                        {desc}
                      </span>
                    </span>
                    <span className="watch-movie-card-title">
                      {m.title.trim() || 'Untitled'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
