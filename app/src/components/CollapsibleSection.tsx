import { useId, useState, type ReactNode } from 'react'

type Props = {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className = '',
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const baseId = useId()
  const headingId = `${baseId}-heading`
  const panelId = `${baseId}-panel`

  return (
    <section
      className={`collapsible-section ${className}`.trim()}
      aria-labelledby={headingId}
    >
      <div className="collapsible-section-head">
        <h2 className="collapsible-section-title" id={headingId}>
          {title}
        </h2>
        <button
          type="button"
          className="collapsible-section-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr-only">{open ? 'Collapse section' : 'Expand section'}</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            aria-hidden
            className={`collapsible-chevron${open ? ' collapsible-chevron-open' : ''}`}
          >
            <path
              fill="currentColor"
              d="M12 15.4 6 9.4l1.4-1.4 4.6 4.6 4.6-4.6L18 9.4l-6 6z"
            />
          </svg>
        </button>
      </div>
      <div
        id={panelId}
        className="collapsible-section-body"
        hidden={!open}
      >
        {children}
      </div>
    </section>
  )
}
