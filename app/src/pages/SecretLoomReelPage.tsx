import { useMemo, useState } from 'react'
import { youtubeThumbnailUrl } from '../lib/youtubeUrl'

const LOOM_REEL_VIDEO_ID = 'VsDvS3j7Zf0'

/**
 * Unlisted route `/teaser`: full-page YouTube, click to start, then loop.
 * Not linked from site navigation — share the URL only.
 */
export function SecretLoomReelPage() {
  const [started, setStarted] = useState(false)
  const poster = youtubeThumbnailUrl(LOOM_REEL_VIDEO_ID, 'hq')
  const embedSrc = useMemo(
    () =>
      `https://www.youtube.com/embed/${encodeURIComponent(LOOM_REEL_VIDEO_ID)}?` +
      new URLSearchParams({
        autoplay: '1',
        loop: '1',
        playlist: LOOM_REEL_VIDEO_ID,
        rel: '0',
        playsinline: '1',
        modestbranding: '1',
      }).toString(),
    [],
  )

  return (
    <div className="frontier-pitch-page">
      {!started && (
        <button
          type="button"
          className="frontier-pitch-gate"
          style={{ backgroundImage: `url(${poster})` }}
          onClick={() => setStarted(true)}
        >
          <span className="frontier-pitch-gate-inner" aria-hidden="true" />
          <span className="sr-only">Play video</span>
        </button>
      )}
      {started && (
        <div className="frontier-pitch-yt">
          <iframe
            title="Loom reel"
            src={embedSrc}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}
