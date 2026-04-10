import { useEffect, useRef, useState } from 'react'
import { decodeVersion } from '../stakeToCurate/client'
import { demoVideoSrc } from './videoSources'

type V = ReturnType<typeof decodeVersion>

type Props = {
  activeVersion: 0 | 1 | null
  v0: V | null
  v1: V | null
  connected: boolean
  busy: boolean
  onRoll: () => void
}

export function FanStage({
  activeVersion,
  v0,
  v1,
  connected,
  busy,
  onRoll,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoError, setVideoError] = useState(false)
  const src =
    activeVersion !== null ? demoVideoSrc(activeVersion) : undefined

  useEffect(() => {
    setVideoError(false)
  }, [src, activeVersion])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !src) return
    el.load()
    void el.play().catch(() => {
      /* autoplay may be blocked until user gesture */
    })
  }, [src, activeVersion])

  const showPlaceholder = !connected
  const showInitHint = connected && !v0 && !v1
  const canRoll = !!(v0 && v1)

  return (
    <section className="panel fan-stage" aria-labelledby="fan-stage-heading">
      <h2 id="fan-stage-heading" className="sr-only">
        Watch
      </h2>
      <div className="fan-video-wrap">
        {showPlaceholder && (
          <div className="fan-video-placeholder">
            <p>Connect your wallet to load the demo stream.</p>
          </div>
        )}
        {showInitHint && (
          <div className="fan-video-placeholder">
            <p>
              This slot is not initialized yet. Ask a platform admin to run Setup,
              or switch to the <strong>Admin</strong> tab if that is you.
            </p>
          </div>
        )}
        {!showPlaceholder &&
          !showInitHint &&
          activeVersion !== null &&
          src &&
          videoError && (
            <div className="fan-video-placeholder">
              <p>
                Could not load this clip. Add{' '}
                <code>demo-v{activeVersion}.mp4</code> under{' '}
                <code>app/public/</code> or set{' '}
                <code>VITE_DEMO_VIDEO_V{activeVersion}</code> in <code>.env</code>.
              </p>
            </div>
          )}
        {!showPlaceholder &&
          !showInitHint &&
          activeVersion !== null &&
          src &&
          !videoError && (
          <>
            <video
              ref={videoRef}
              key={src}
              className="fan-video"
              src={src}
              controls
              playsInline
              loop
              muted
              onError={() => setVideoError(true)}
            />
            <p className="fan-now-playing">
              Now playing: <strong>Version {activeVersion}</strong>
              {v0 && v1 && (
                <span className="fan-rank-hint">
                  {' '}
                  (ranks {v0.rank.toString()} / {v1.rank.toString()})
                </span>
              )}
            </p>
          </>
        )}
      </div>
      <p className="muted fan-playback-copy">
        Which cut you see is weighted by on-chain ranks: P(v) ∝ rank_v / (rank0 +
        rank1). Roll to sample another play.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !canRoll}
        onClick={onRoll}
      >
        Roll next clip
      </button>
    </section>
  )
}
