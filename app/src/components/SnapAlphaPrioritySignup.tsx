import { type FormEvent, useState } from 'react'
import { getEverriseSnapBuyUrl } from '../config/everriseSnap'
import { sceneBoardApiUrl } from '../storage/sceneBoardSession'

export type SnapAlphaPrioritySource = 'landing' | 'watch'

type Props = {
  source: SnapAlphaPrioritySource
}

export function SnapAlphaPrioritySignup({ source }: Props) {
  const buyUrl = getEverriseSnapBuyUrl()
  const [email, setEmail] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const em = email.trim()
    const w = walletAddress.trim()
    if (!em || !w) {
      setError('Enter your email and the Solana wallet you plan to use.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(sceneBoardApiUrl('/api/snap-alpha-priority'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: em,
          wallet_address: w,
          source,
        }),
      })
      const text = await res.text()
      if (!res.ok) {
        let msg = text || res.statusText
        try {
          const j = JSON.parse(text) as { error?: string }
          if (j.error) msg = j.error
        } catch {
          /* use raw */
        }
        setError(msg)
        return
      }
      setDone(true)
      setEmail('')
      setWalletAddress('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="snap-alpha-priority">
      <div className="snap-alpha-priority-copy">
        <p className="snap-alpha-priority-body">
          Want priority access to SnapCinema tools during the alpha? Secure your spot by
          purchasing at least <strong>50,000 $SNAP</strong> from{' '}
          <a
            href={buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="snap-alpha-inline-link"
          >
            everrise.club
          </a>
          .
        </p>
        <p className="snap-alpha-priority-body">
          Wallets that hold $SNAP will be prioritized when alpha access opens.
        </p>
        <p className="snap-alpha-priority-body">
          Register the wallet you plan to use and your email so we can match you when tools
          go live.
        </p>
      </div>
      <a
        href={buyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary mortal-pump-cta-btn snap-alpha-buy-btn"
      >
        Buy $SNAP on everrise.club
      </a>
      {done ? (
        <p className="mailing-list-signup-success" role="status">
          You&apos;re registered. We&apos;ll use this wallet and email when alpha opens.
        </p>
      ) : (
        <form className="mailing-list-signup-form" onSubmit={(e) => void onSubmit(e)}>
          <div className="mailing-list-signup-fields">
            <label className="mailing-list-signup-label">
              <span>Email</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                className="mailing-list-signup-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={busy}
                required
              />
            </label>
            <label className="mailing-list-signup-label">
              <span>Wallet address</span>
              <input
                type="text"
                name="wallet_address"
                autoComplete="off"
                className="mailing-list-signup-input"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Solana wallet holding $SNAP"
                disabled={busy}
                required
                spellCheck={false}
              />
            </label>
          </div>
          {error ? (
            <p className="mailing-list-signup-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Register for priority access'}
          </button>
        </form>
      )}
    </div>
  )
}
