import { decodeScenePosition } from '../stakeToCurate/client'
import { lamportsToSol } from './format'

type P = ReturnType<typeof decodeScenePosition>

type Props = {
  positions: Array<{ sceneKeyHex: string; position: P }>
  connected: boolean
}

export function PositionsPanel({ positions, connected }: Props) {
  const positionHint = !connected
    ? 'Connect wallet to see your positions.'
    : 'No open scene positions — stake from Watch or Scene hover.'

  return (
    <section className="panel" aria-labelledby="positions-heading">
      <h2 id="positions-heading">4. Your scene positions</h2>
      {positions.length === 0 ? (
        <p className="muted empty-hint">{positionHint}</p>
      ) : (
        <ul className="stats scene-position-list">
          {positions.map(({ sceneKeyHex, position }) => (
            <li key={sceneKeyHex} className="scene-position-item">
              <div className="muted scene-key-mono">
                {sceneKeyHex.slice(0, 12)}…{sceneKeyHex.slice(-8)}
              </div>
              <ul className="stats nested">
                <li>staked: {lamportsToSol(position.amount)} SOL</li>
                <li>side: {position.isUp ? 'up' : 'down'}</li>
                <li>active: {position.isActive ? 'yes' : 'residual'}</li>
                <li>entry_rank: {position.entryRank.toString()}</li>
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
