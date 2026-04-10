import { useState } from 'react'

/**
 * Phase 1: trailer lives on YouTube (creator pays nothing extra vs IPFS pinning).
 * Concept deck stays optional local file pick — not uploaded in this demo.
 */
export function CreatorConceptPanel() {
  const [trailerYoutubeUrl, setTrailerYoutubeUrl] = useState('')

  return (
    <section className="panel" aria-labelledby="concept-heading">
      <h2 id="concept-heading">Your release</h2>
      <p className="muted">
        Link a <strong>YouTube</strong> trailer or scene cut — we use YouTube for storage
        and playback for now (unlisted or public). Optional concept deck below stays in
        the browser only until you wire uploads.
      </p>
      <div className="creator-upload-row">
        <label className="field-label">
          Trailer / cut — YouTube URL
          <input
            type="url"
            className="text-input creator-youtube-input"
            value={trailerYoutubeUrl}
            onChange={(e) => setTrailerYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
          />
        </label>
      </div>
      <div className="creator-upload-row">
        <label className="field-label">
          Concept deck / pitch (optional, PDF or text — local only)
          <input type="file" className="file-input" accept=".pdf,.txt,.md" />
        </label>
      </div>
    </section>
  )
}
