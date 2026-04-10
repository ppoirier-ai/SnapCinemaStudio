import { useState, type FormEvent } from 'react'
import { DEMO_SLOT_ID } from '../stakeToCurate/client'

type Props = {
  onBack: () => void
  onSubmitted: (summary: string) => void
}

export function FanContributePanel({ onBack, onSubmitted }: Props) {
  const [pitch, setPitch] = useState('')
  const [url, setUrl] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const summary = [
      pitch.trim() || '(no pitch)',
      url.trim() || '(no URL)',
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
        Slot <strong>{DEMO_SLOT_ID}</strong> (demo). Share a link or file reference
        for a replacement cut. This does not register a new on-chain version by
        itself — platform ops handle that after review.
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
          Video URL (optional)
          <input
            type="url"
            className="text-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <label className="field-label">
          Or attach a file (local only, not uploaded)
          <input type="file" className="file-input" accept="video/*" />
        </label>
        <button type="submit" className="btn btn-primary">
          Submit for review
        </button>
      </form>
    </div>
  )
}
