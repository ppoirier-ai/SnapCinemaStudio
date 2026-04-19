import { type FormEvent, useState } from 'react'
import { sceneBoardApiUrl } from '../storage/sceneBoardSession'

export type MailingListSource = 'landing' | 'watch'

type Props = {
  source: MailingListSource
  className?: string
}

export function MailingListSignup({ source, className }: Props) {
  const [email, setEmail] = useState('')
  const [telegram, setTelegram] = useState('')
  const [intent, setIntent] = useState<'watch' | 'contribute'>('watch')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const em = email.trim()
    const tg = telegram.trim().replace(/^@+/, '')
    if (!em && !tg) {
      setError('Enter at least an email address or a Telegram username / ID.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(sceneBoardApiUrl('/api/mailing-list'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: em || undefined,
          telegram: tg || undefined,
          intent,
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
      setTelegram('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const rootClass = ['mailing-list-signup', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <p className="mailing-list-signup-eyebrow">Join the waitlist</p>
      <p className="mailing-list-signup-lead">
        We&apos;ll contact you when SnapCinema moves to <strong>mainnet</strong>. Until
        then, you can try the app on <strong>Solana devnet</strong>: there is{' '}
        <strong>no real money</strong> involved. Testing wallet flows requires{' '}
        <strong>devnet SOL</strong> (free from a faucet).
      </p>
      {done ? (
        <p className="mailing-list-signup-success" role="status">
          You&apos;re on the list. Thanks—we&apos;ll be in touch.
        </p>
      ) : (
        <form className="mailing-list-signup-form" onSubmit={(e) => void onSubmit(e)}>
          <div className="mailing-list-signup-fields">
            <label className="mailing-list-signup-label">
              <span>Email (optional)</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                className="mailing-list-signup-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={busy}
              />
            </label>
            <label className="mailing-list-signup-label">
              <span>Telegram (optional)</span>
              <input
                type="text"
                name="telegram"
                className="mailing-list-signup-input"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username or numeric ID"
                disabled={busy}
              />
            </label>
            <label className="mailing-list-signup-label">
              <span>I plan to mainly…</span>
              <select
                className="mailing-list-signup-select"
                value={intent}
                onChange={(e) =>
                  setIntent(e.target.value === 'contribute' ? 'contribute' : 'watch')
                }
                disabled={busy}
              >
                <option value="watch">Watch to earn</option>
                <option value="contribute">Contribute to earn</option>
              </select>
            </label>
          </div>
          {error ? (
            <p className="mailing-list-signup-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Join the mailing list'}
          </button>
        </form>
      )}
    </div>
  )
}
