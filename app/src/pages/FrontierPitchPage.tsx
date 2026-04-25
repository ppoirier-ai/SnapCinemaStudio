import { useEffect, useId, useRef, useState } from 'react'
import { youtubeThumbnailUrl } from '../lib/youtubeUrl'

const FRONTIER_PITCH_VIDEO_ID = 'YXQIiUknx2w'

const YT_ENDED = 0

type YTPlayer = {
  destroy(): void
  playVideo(): void
}

type YTNamespace = {
  Player: new (elementId: string, options: Record<string, unknown>) => YTPlayer
}

function loadYoutubeIframeApi(): Promise<void> {
  const w = window as Window & {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
  if (w.YT?.Player) return Promise.resolve()
  return new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(s)
    }
  })
}

function FrontierPitchPlayer({
  videoId,
  onEnded,
}: {
  videoId: string
  onEnded: () => void
}) {
  const reactId = useId().replace(/:/g, '')
  const containerId = `frontier-pitch-yt-${reactId}`
  const onEndedRef = useRef(onEnded)
  const playerRef = useRef<YTPlayer | null>(null)

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  useEffect(() => {
    let cancelled = false
    const w = window as Window & { YT?: YTNamespace }

    void loadYoutubeIframeApi().then(() => {
      if (cancelled || !w.YT?.Player) return
      try {
        playerRef.current?.destroy()
      } catch {
        /* ignore */
      }
      playerRef.current = null
      playerRef.current = new w.YT.Player(containerId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          modestbranding: 1,
        },
        events: {
          onReady: (e: { target: YTPlayer }) => {
            e.target.playVideo()
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === YT_ENDED) onEndedRef.current()
          },
        },
      })
    })

    return () => {
      cancelled = true
      try {
        playerRef.current?.destroy()
      } catch {
        /* ignore */
      }
      playerRef.current = null
    }
  }, [containerId, videoId])

  return <div className="frontier-pitch-yt" id={containerId} title="Frontier pitch" />
}

/**
 * Unlisted marketing route: full-page YouTube, click to start, no replay after end.
 * Not linked from site navigation.
 */
export function FrontierPitchPage() {
  const [phase, setPhase] = useState<'gate' | 'playing' | 'ended'>('gate')
  const poster = youtubeThumbnailUrl(FRONTIER_PITCH_VIDEO_ID, 'hq')

  return (
    <div className="frontier-pitch-page">
      {phase === 'gate' && (
        <button
          type="button"
          className="frontier-pitch-gate"
          style={{ backgroundImage: `url(${poster})` }}
          onClick={() => setPhase('playing')}
        >
          <span className="frontier-pitch-gate-inner" aria-hidden="true" />
          <span className="sr-only">Play video</span>
        </button>
      )}
      {phase === 'playing' && (
        <FrontierPitchPlayer
          videoId={FRONTIER_PITCH_VIDEO_ID}
          onEnded={() => setPhase('ended')}
        />
      )}
      {phase === 'ended' && <div className="frontier-pitch-end" aria-hidden="true" />}
    </div>
  )
}
