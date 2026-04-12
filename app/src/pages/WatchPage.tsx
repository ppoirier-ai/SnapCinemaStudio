import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { YoutubeWatchPlayer } from '../components/YoutubeWatchPlayer'
import { useDemoSlot } from '../context/DemoSlotContext'
import {
  getFirstYoutubeVideoIdFromMovie,
  useMovies,
  type Movie,
} from '../context/SceneBoardContext'
import { FAN_REACTION_LAMPORTS } from '../demo/constants'
import { lamportsToSol } from '../demo/format'
import { IconFlag, IconThumbDown, IconThumbUp } from '../components/ReactionIcons'
import { envYoutubeVideoId, youtubeEmbedSrc } from '../lib/youtubeEmbed'
import {
  buildWatchPlaylist,
  type WatchPlaylistClip,
} from '../lib/watchPlaylist'
import { youtubeThumbnailUrl } from '../lib/youtubeUrl'

function posterForMovie(m: Movie): string | null {
  const id = getFirstYoutubeVideoIdFromMovie(m)
  return id ? youtubeThumbnailUrl(id) : null
}

function formatSessionTimeLeft(expiresAtMs: number): string {
  const ms = Math.max(0, expiresAtMs - Date.now())
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function WatchShortPlayback({
  movie,
  rankBySceneKeyHex,
  envVid,
  envEmbed,
  playerTitle,
  onCurrentClipChange,
}: {
  movie: Movie | null
  rankBySceneKeyHex: Record<string, bigint>
  envVid: string | null
  envEmbed: string | null
  playerTitle: string
  onCurrentClipChange?: (clip: WatchPlaylistClip | null) => void
}) {
  const [playlistKey, setPlaylistKey] = useState(0)
  const [clipIndex, setClipIndex] = useState(0)

  const clips = useMemo(() => {
    void playlistKey
    if (movie) {
      const p = buildWatchPlaylist(movie, rankBySceneKeyHex)
      if (p.length > 0) return p
    }
    if (envVid) return [{ videoId: envVid, columnIndex: -1, cellId: '', columnId: '', sceneKeyHex: '' }]
    return []
  }, [movie, rankBySceneKeyHex, playlistKey, envVid])

  const clipsRef = useRef(clips)
  useEffect(() => {
    clipsRef.current = clips
  }, [clips])

  const n = clips.length
  const safeIndex = n === 0 ? 0 : Math.min(clipIndex, n - 1)
  const currentClip = clips[safeIndex] ?? null

  useEffect(() => {
    onCurrentClipChange?.(currentClip)
  }, [currentClip, onCurrentClipChange])

  const onClipEnded = useCallback(() => {
    setClipIndex((prev) => {
      const list = clipsRef.current
      const len = list.length
      if (len === 0) return 0
      const cur = Math.min(prev, len - 1)
      if (cur + 1 < len) return cur + 1
      queueMicrotask(() => setPlaylistKey((k) => k + 1))
      return 0
    })
  }, [])

  const currentVideoId = currentClip?.videoId ?? null

  const fromMovieVid = movie
    ? getFirstYoutubeVideoIdFromMovie(movie)
    : null
  const embedSrc =
    !currentVideoId && fromMovieVid
      ? `https://www.youtube.com/embed/${fromMovieVid}?rel=0`
      : !currentVideoId
        ? envEmbed
        : null

  return (
    <>
      {currentVideoId ? (
        <YoutubeWatchPlayer
          key={`${currentVideoId}-${safeIndex}`}
          videoId={currentVideoId}
          onEnded={onClipEnded}
          title={playerTitle}
        />
      ) : embedSrc ? (
        <iframe
          title={playerTitle}
          src={embedSrc}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div className="watch-short-placeholder">
          <p>
            Add YouTube scenes via the wallet menu (<strong>Scene</strong>), pick a
            movie below, or set <code>VITE_YOUTUBE_SHORT_ID</code> /{' '}
            <code>VITE_YOUTUBE_EMBED_URL</code> in <code>.env</code>.
          </p>
        </div>
      )}
    </>
  )
}

export function WatchPage() {
  const envEmbed = youtubeEmbedSrc()
  const envVid = envYoutubeVideoId()
  const { movies, watchMovieId, setWatchMovieId, getMovie } = useMovies()
  const {
    chainSynced,
    rankBySceneKeyHex,
    busy,
    connected,
    signTransaction,
    getSceneRow,
    onStakeUp,
    onStakeDown,
    setToast,
    instantSessionMeta,
    instantSessionBalanceLamports,
    instantStakingSessionActive,
    enableInstantStaking,
    topUpInstantSession,
    endInstantSession,
    ensureInstantSessionForWatch,
    refreshOnChain,
    slotInitialized,
  } = useDemoSlot()

  const playingMovie =
    (watchMovieId ? getMovie(watchMovieId) : null) ?? movies[0] ?? null

  const playbackKey =
    playingMovie?.id ?? (envVid ? `env:${envVid}` : 'none')

  const [currentSceneKeyHex, setCurrentSceneKeyHex] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (!playingMovie || !connected) return
    void refreshOnChain(playingMovie)
  }, [playingMovie?.id, connected, refreshOnChain, playingMovie])

  /** When the weighted playlist advances to another cell, re-fetch that scene’s on-chain row
   *  so thumbs enable without a full page reload (merge refresh keeps other keys). */
  useEffect(() => {
    if (!playingMovie || !connected || !currentSceneKeyHex) return
    const t = window.setTimeout(() => {
      void refreshOnChain(playingMovie)
    }, 200)
    return () => window.clearTimeout(t)
  }, [currentSceneKeyHex, playingMovie, connected, refreshOnChain])

  const currentRow = currentSceneKeyHex
    ? getSceneRow(currentSceneKeyHex)
    : undefined
  const sceneReady = Boolean(currentRow?.scene)

  const slotMissingOnChain = chainSynced && !slotInitialized
  const reactionsDisabled =
    !connected ||
    busy ||
    !chainSynced ||
    (!signTransaction && !instantStakingSessionActive) ||
    !currentSceneKeyHex ||
    !sceneReady

  const onThumbUp = async () => {
    if (!currentSceneKeyHex) return
    if (!instantStakingSessionActive) {
      const ok = await ensureInstantSessionForWatch()
      if (!ok) return
    }
    void onStakeUp(currentSceneKeyHex, FAN_REACTION_LAMPORTS)
  }

  const onThumbDown = async () => {
    if (!currentSceneKeyHex) return
    if (!instantStakingSessionActive) {
      const ok = await ensureInstantSessionForWatch()
      if (!ok) return
    }
    void onStakeDown(currentSceneKeyHex, FAN_REACTION_LAMPORTS)
  }

  const onFlag = async () => {
    if (!currentSceneKeyHex) return
    if (!instantStakingSessionActive) {
      const ok = await ensureInstantSessionForWatch()
      if (!ok) return
    }
    void onStakeDown(currentSceneKeyHex, FAN_REACTION_LAMPORTS)
    setToast('Flag sent: stake_down on this scene (devnet).')
  }

  const playerTitle =
    playingMovie?.title.trim()
      ? `${playingMovie.title} — SnapCinema`
      : 'SnapCinema demo short'

  return (
    <main className="studio watch-page">
      <div className="watch-short-shell">
        <div className="watch-short-frame">
          <WatchShortPlayback
            key={playbackKey}
            movie={playingMovie}
            rankBySceneKeyHex={rankBySceneKeyHex}
            envVid={envVid}
            envEmbed={envEmbed}
            playerTitle={playerTitle}
            onCurrentClipChange={(c) =>
              setCurrentSceneKeyHex(
                c?.sceneKeyHex && c.sceneKeyHex.length === 64 ? c.sceneKeyHex : null,
              )
            }
          />
        </div>
        {playingMovie && (
          <p className="muted watch-now-playing-title">
            Now showing:{' '}
            <strong>{playingMovie.title.trim() || 'Untitled'}</strong>
          </p>
        )}
        {!chainSynced && connected && (
          <p className="muted watch-curate-hint" role="status">
            Loading on-chain slot…
          </p>
        )}
        {slotMissingOnChain && (
          <p className="muted watch-curate-hint" role="note">
            The shared demo slot is not initialized on this cluster yet. A platform
            admin must connect the <strong>slot authority</strong> wallet and run{' '}
            <strong>Studio → Admin → Initialize</strong> once (see{' '}
            <code>VITE_STAKE_SLOT_AUTHORITY</code> in <code>.env.example</code>).
          </p>
        )}
        {connected &&
          chainSynced &&
          slotInitialized &&
          playingMovie &&
          currentSceneKeyHex &&
          !sceneReady && (
            <p className="muted watch-curate-hint" role="note">
              This clip is not registered on-chain yet. The <strong>slot authority</strong>{' '}
              wallet should open the <strong>Scene</strong> tab once so playable cells
              call <code>register_scene</code> (or add the YouTube URL while connected as
              authority).
            </p>
          )}
        {connected && chainSynced && (
          <div className="watch-instant-session" aria-label="Instant staking session">
            {instantStakingSessionActive && instantSessionMeta ? (
              <p className="watch-instant-session-status" role="status">
                Session active —{' '}
                {instantSessionBalanceLamports != null
                  ? `${lamportsToSol(instantSessionBalanceLamports)} SOL`
                  : '… SOL'}{' '}
                on session wallet · {formatSessionTimeLeft(instantSessionMeta.expiresAtMs)}{' '}
                left
              </p>
            ) : (
              <p className="muted watch-instant-session-status" role="note">
                One Phantom approval funds a 2.5h session (up to 1 SOL); every thumbs
                up/down after that is instant.
              </p>
            )}
            <div className="watch-instant-session-actions">
              {!instantStakingSessionActive ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!connected || busy || !signTransaction}
                  onClick={() => enableInstantStaking()}
                >
                  Enable Instant Staking
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy || !signTransaction}
                    onClick={() => topUpInstantSession()}
                  >
                    Top Up Session (1 SOL max)
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => endInstantSession()}
                  >
                    End Session
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <div className="watch-reaction-bar" role="group" aria-label="Curate clip">
          <button
            type="button"
            className="watch-icon-btn watch-icon-btn-up"
            disabled={reactionsDisabled}
            onClick={onThumbUp}
            aria-label="Thumbs up"
          >
            <IconThumbUp className="watch-icon-svg" />
          </button>
          <button
            type="button"
            className="watch-icon-btn watch-icon-btn-down"
            disabled={reactionsDisabled}
            onClick={onThumbDown}
            aria-label="Thumbs down"
          >
            <IconThumbDown className="watch-icon-svg" />
          </button>
          <button
            type="button"
            className="watch-icon-btn watch-icon-btn-flag"
            disabled={reactionsDisabled}
            onClick={onFlag}
            aria-label="Flag (stake down on playing scene)"
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
            add scenes from the wallet menu (Scene).
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
