import { decodeVersion } from '../stakeToCurate/client'
import { lamportsToSol } from './format'

type V = ReturnType<typeof decodeVersion>

type Props = {
  v0: V | null
  v1: V | null
  connected: boolean
}

export function VersionsPanel({ v0, v1, connected }: Props) {
  const versionHint = !connected
    ? 'Connect wallet to load on-chain data.'
    : 'No version account yet — platform admin must run Setup.'

  return (
    <section className="panel" aria-labelledby="versions-heading">
      <h2 id="versions-heading">2. Versions &amp; ranks</h2>
      <div className="grid2">
        <div className="version-card">
          <h3>Version 0</h3>
          {v0 ? (
            <ul className="stats">
              <li>rank: {v0.rank.toString()}</li>
              <li>active stake: {lamportsToSol(v0.activeStake)} SOL</li>
            </ul>
          ) : (
            <p className="muted empty-hint">{versionHint}</p>
          )}
        </div>
        <div className="version-card">
          <h3>Version 1</h3>
          {v1 ? (
            <ul className="stats">
              <li>rank: {v1.rank.toString()}</li>
              <li>active stake: {lamportsToSol(v1.activeStake)} SOL</li>
            </ul>
          ) : (
            <p className="muted empty-hint">{versionHint}</p>
          )}
        </div>
      </div>
    </section>
  )
}
