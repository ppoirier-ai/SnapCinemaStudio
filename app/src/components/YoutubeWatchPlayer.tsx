import { useEffect, useId, useRef } from 'react'

/** YT.PlayerState.ENDED */
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

export function YoutubeWatchPlayer({
  videoId,
  onEnded,
  title,
}: {
  videoId: string
  onEnded: () => void
  title: string
}) {
  const reactId = useId().replace(/:/g, '')
  const containerId = `yt-watch-${reactId}`
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

  return (
    <div className="watch-youtube-api-root">
      <div
        id={containerId}
        className="watch-youtube-api-target"
        title={title}
      />
    </div>
  )
}
