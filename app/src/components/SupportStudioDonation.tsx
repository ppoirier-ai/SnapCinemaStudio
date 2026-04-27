import { useCallback, useEffect, useRef, useState } from 'react'
import { getPlatformOwnerPubkeyString } from '../config/platformOwner'

const COPIED_RESET_MS = 3500

export function SupportStudioDonation() {
  const recipientStr = getPlatformOwnerPubkeyString()
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const onCopyAddress = useCallback(async () => {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(recipientStr)
      setCopied(true)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => {
        setCopied(false)
        resetTimerRef.current = null
      }, COPIED_RESET_MS)
    } catch {
      setCopied(false)
      setCopyError('Could not copy—select the address and copy manually.')
    }
  }, [recipientStr])

  return (
    <div className="support-studio-donation">
      <h2 id="support-heading" className="support-studio-donation-title">
        Support SnapCinema Studio
      </h2>
      <p className="support-studio-donation-eyebrow">Fund the build</p>
      <p className="support-studio-donation-lead">
        Donations are <strong>real Solana on mainnet</strong>. In Phantom, switch to{' '}
        <strong>mainnet</strong> before you send so the network matches your transfer.
      </p>
      <button
        type="button"
        className="support-studio-donation-address-btn"
        onClick={() => void onCopyAddress()}
      >
        {recipientStr}
      </button>
      {copied ? (
        <p className="support-studio-donation-copied" role="status">
          Address copied to clipboard.
        </p>
      ) : null}
      {copyError ? (
        <p className="mailing-list-signup-error" role="alert">
          {copyError}
        </p>
      ) : null}
    </div>
  )
}
