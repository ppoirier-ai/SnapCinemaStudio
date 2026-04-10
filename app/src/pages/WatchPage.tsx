import { useDemoSlot } from '../context/DemoSlotContext'
import { FAN_REACTION_LAMPORTS } from '../demo/constants'
import { IconFlag, IconThumbDown, IconThumbUp } from '../components/ReactionIcons'
import { youtubeEmbedSrc } from '../lib/youtubeEmbed'

export function WatchPage() {
  const embedSrc = youtubeEmbedSrc()
  const {
    playback,
    busy,
    connected,
    onStakeUp,
    onStakeDown,
    setToast,
    append,
  } = useDemoSlot()

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
              title="SnapCinema demo short"
              src={embedSrc}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="watch-short-placeholder">
              <p>
                Set <code>VITE_YOUTUBE_SHORT_ID</code> or{' '}
                <code>VITE_YOUTUBE_EMBED_URL</code> in <code>.env</code> to embed a
                YouTube Short.
              </p>
            </div>
          )}
        </div>
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
    </main>
  )
}
