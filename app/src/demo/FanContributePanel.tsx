import { useState, type FormEvent } from 'react'
import { DEMO_SLOT_ID } from '../stakeToCurate/client'
import { isProbablyYoutubeUrl } from '../lib/youtubeUrl'

type Props = {
  onBack: () => void
  onSubmitted: (summary: string) => void
}

export function FanContributePanel({ onBack, onSubmitted }: Props) {
  const [pitch, setPitch] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [done, setDone] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = youtubeUrl.trim()
    if (!isProbablyYoutubeUrl(trimmed)) {
      setUrlError('Enter a full YouTube link (youtube.com, youtu.be, or Shorts URL).')
      return
    }
    setUrlError(null)
    const summary = [
      pitch.trim() || '(no pitch)',
      trimmed,
    ].join(' | ')
    onSubmitted(
      `Fan contribute: queued for platform review — ${summary} (slot ${DEMO_SLOT_ID})`,
    )
    setDone(true)
  }

  if (done) {
    return (
      <div className="fan-contribute panel">
        <h2>Thanks — submission received</h2>
        <p className="muted">
          New scene cuts are reviewed by SnapCinema Studio admins. When approved,
          a new version can be registered on-chain for this slot (permissionless
          registration is a future upgrade).
        </p>
        <button type="button" className="btn btn-primary" onClick={onBack}>
          Back to watching
        </button>
      </div>
    )
  }

  return (
    <div className="fan-contribute panel">
      <button
        type="button"
        className="btn btn-ghost fan-back-inline"
        onClick={onBack}
      >
        Back to watching
      </button>
      <h2>Contribute an alternate scene</h2>
      <p className="muted">
        Slot <strong>{DEMO_SLOT_ID}</strong> (demo). Paste a <strong>YouTube</strong>{' '}
        link to your cut (public or unlisted). Nothing is uploaded from this app —
        platform ops review the link and can wire it after approval. IPFS / other
        storage can come later.
      </p>
      <form className="fan-contribute-form" onSubmit={handleSubmit}>
        <label className="field-label">
          One-line pitch
          <input
            type="text"
            className="text-input"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder="Why this cut should compete…"
            maxLength={200}
          />
        </label>
        <label className="field-label">
          YouTube link for your cut <span className="field-required">(required)</span>
          <input
            type="url"
            className="text-input"
            value={youtubeUrl}
            onChange={(e) => {
              setYoutubeUrl(e.target.value)
              if (urlError) setUrlError(null)
            }}
            placeholder="https://www.youtube.com/watch?v=… or Shorts / youtu.be link"
            aria-invalid={urlError ? true : undefined}
            aria-describedby={urlError ? 'contribute-youtube-error' : undefined}
          />
        </label>
        {urlError && (
          <p id="contribute-youtube-error" className="field-error" role="alert">
            {urlError}
          </p>
        )}
        <button type="submit" className="btn btn-primary">
          Submit for review
        </button>
      </form>
    </div>
  )
}
