import { decodePosition } from '../stakeToCurate/client'
import { lamportsToSol } from './format'

type P = ReturnType<typeof decodePosition>

type Props = {
  pos0: P | null
  pos1: P | null
  connected: boolean
}

export function PositionsPanel({ pos0, pos1, connected }: Props) {
  const positionHint = !connected
    ? 'Connect wallet to see your positions.'
    : 'No open position for this version — stake first.'

  return (
    <section className="panel" aria-labelledby="positions-heading">
      <h2 id="positions-heading">4. Your positions</h2>
      <div className="grid2">
        <div className="version-card">
          <h3>On version 0</h3>
          {pos0 ? (
            <ul className="stats">
              <li>staked: {lamportsToSol(pos0.amount)} SOL</li>
              <li>side: {pos0.isUp ? 'up' : 'down'}</li>
              <li>active: {pos0.isActive ? 'yes' : 'residual'}</li>
              <li>entry_rank: {pos0.entryRank.toString()}</li>
              <li>accrued: {lamportsToSol(pos0.accruedRewards)} SOL</li>
            </ul>
          ) : (
            <p className="muted empty-hint">{positionHint}</p>
          )}
        </div>
        <div className="version-card">
          <h3>On version 1</h3>
          {pos1 ? (
            <ul className="stats">
              <li>staked: {lamportsToSol(pos1.amount)} SOL</li>
              <li>side: {pos1.isUp ? 'up' : 'down'}</li>
              <li>active: {pos1.isActive ? 'yes' : 'residual'}</li>
              <li>entry_rank: {pos1.entryRank.toString()}</li>
              <li>accrued: {lamportsToSol(pos1.accruedRewards)} SOL</li>
            </ul>
          ) : (
            <p className="muted empty-hint">{positionHint}</p>
          )}
        </div>
      </div>
    </section>
  )
}
