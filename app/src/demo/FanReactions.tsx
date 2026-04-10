type Props = {
  disabled: boolean
  activeVersion: 0 | 1 | null
  onThumbUp: () => void
  onThumbDown: () => void
  onFlag: () => void
}

export function FanReactions({
  disabled,
  activeVersion,
  onThumbUp,
  onThumbDown,
  onFlag,
}: Props) {
  const d = disabled || activeVersion === null

  return (
    <section className="panel fan-reactions" aria-label="Curate this clip">
      <h2 className="fan-reactions-title">How is this cut?</h2>
      <p className="muted fan-reactions-sub">
        Thumbs use a small preset stake (0.01 SOL) on the version currently playing.
      </p>
      <div className="fan-reaction-buttons">
        <button
          type="button"
          className="btn btn-secondary fan-thumb fan-thumb-up"
          disabled={d}
          onClick={onThumbUp}
        >
          Thumbs up
        </button>
        <button
          type="button"
          className="btn btn-secondary fan-thumb fan-thumb-down"
          disabled={d}
          onClick={onThumbDown}
        >
          Thumbs down
        </button>
        <button
          type="button"
          className="btn btn-ghost fan-flag"
          disabled={d}
          onClick={onFlag}
        >
          Flag
        </button>
      </div>
    </section>
  )
}
