/**
 * Placeholder uploads for hackathon narrative (concept + trailer).
 * Files are not persisted server-side in Phase 1.
 */
export function CreatorConceptPanel() {
  return (
    <section className="panel" aria-labelledby="concept-heading">
      <h2 id="concept-heading">Your release</h2>
      <p className="muted">
        Upload your movie concept and trailer for this slot. In this demo, files stay
        in the browser only — wire storage or IPFS when you ship.
      </p>
      <div className="creator-upload-row">
        <label className="field-label">
          Concept deck / pitch (PDF or text)
          <input type="file" className="file-input" accept=".pdf,.txt,.md" />
        </label>
      </div>
      <div className="creator-upload-row">
        <label className="field-label">
          Trailer video
          <input type="file" className="file-input" accept="video/*" />
        </label>
      </div>
    </section>
  )
}
