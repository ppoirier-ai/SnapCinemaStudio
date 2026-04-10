import { useEffect, useRef, type ComponentProps } from 'react'
import { AccountPanelContent } from './AccountPanelContent'

type Props = {
  open: boolean
  onClose: () => void
} & ComponentProps<typeof AccountPanelContent>

export function AccountModal({ open, onClose, ...rest }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="account-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
      >
        <div className="account-modal-head">
          <h2 id="account-modal-title">Account</h2>
          <button
            type="button"
            className="btn btn-ghost account-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <AccountPanelContent {...rest} />
      </div>
    </div>
  )
}
