import { useCallback, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { sceneBoardApiUrl } from '../storage/sceneBoardSession'

export type MailingListRow = {
  id: string
  email: string | null
  telegram: string | null
  intent: string
  source: string
  created_at: string
}

function bytesToB64(u: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]!)
  return btoa(bin)
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function MailingListAdminPanel() {
  const { publicKey, signMessage, connected } = useWallet()
  const [total, setTotal] = useState<number | null>(null)
  const [rows, setRows] = useState<MailingListRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError('Connect the platform owner wallet to load signups.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const wallet = publicKey.toBase58()
      const message = `SnapCinema:mailing-list-admin:v1:${wallet}:${Date.now()}:${crypto.randomUUID()}`
      const sig = await signMessage(new TextEncoder().encode(message))
      const res = await fetch(sceneBoardApiUrl('/api/mailing-list'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'list',
          wallet,
          message,
          signature: bytesToB64(sig),
        }),
      })
      const text = await res.text()
      if (!res.ok) {
        let msg = text || res.statusText
        try {
          const j = JSON.parse(text) as { error?: string }
          if (j.error) msg = j.error
        } catch {
          /* raw */
        }
        setError(msg)
        setTotal(null)
        setRows([])
        return
      }
      const j = JSON.parse(text) as { total?: number; rows?: MailingListRow[] }
      setTotal(typeof j.total === 'number' ? j.total : 0)
      setRows(Array.isArray(j.rows) ? j.rows : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setTotal(null)
      setRows([])
    } finally {
      setBusy(false)
    }
  }, [publicKey, signMessage])

  return (
    <section className="panel mailing-list-admin-panel">
      <h2>Mailing list</h2>
      <p className="muted">
        Waitlist signups from the landing page and Watch footer. Loads from Supabase via
        the deployed API (same env as scene board).
      </p>
      {!connected ? (
        <p className="muted">Connect your wallet to refresh the list.</p>
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? 'Loading…' : 'Refresh list'}
        </button>
      )}
      {error ? (
        <p className="mailing-list-admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {total != null ? (
        <p className="mailing-list-admin-count">
          <strong>{total}</strong> signup{total === 1 ? '' : 's'} total
          {rows.length < total ? (
            <span className="muted"> (showing latest {rows.length})</span>
          ) : null}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <div className="mailing-list-admin-scroll" tabIndex={0}>
          <table className="mailing-list-admin-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Email</th>
                <th scope="col">Telegram</th>
                <th scope="col">Intent</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatWhen(r.created_at)}</td>
                  <td>{r.email ?? '—'}</td>
                  <td>{r.telegram ?? '—'}</td>
                  <td>{r.intent}</td>
                  <td>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
