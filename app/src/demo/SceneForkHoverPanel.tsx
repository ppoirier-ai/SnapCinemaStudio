import type { CSSProperties } from 'react'
import { decodeScene, decodeScenePosition } from '../stakeToCurate/client'
import { lamportsToSol } from './format'

type S = ReturnType<typeof decodeScene>
type P = ReturnType<typeof decodeScenePosition>

export type SceneForkHoverPanelProps = {
  timeLabel: string
  altLabel: string
  sceneKeyHex: string
  chainSynced: boolean
  connected: boolean
  busy: boolean
  scene: S | null
  position: P | null
  onUnstake: (sceneKeyHex: string) => void
  /** Optional inline styles on the panel root (in-page tooltips only). */
  rootStyle?: CSSProperties
  rootClassName?: string
}

type Props = SceneForkHoverPanelProps

function yourUpDownSol(pos: P | null): { up: string; down: string } {
  if (!pos || pos.amount === 0n) {
    return { up: lamportsToSol(0n), down: lamportsToSol(0n) }
  }
  if (pos.isUp) {
    return { up: lamportsToSol(pos.amount), down: lamportsToSol(0n) }
  }
  return { up: lamportsToSol(0n), down: lamportsToSol(pos.amount) }
}

export function SceneForkHoverPanel({
  timeLabel,
  altLabel,
  sceneKeyHex,
  chainSynced,
  connected,
  busy,
  scene,
  position,
  onUnstake,
  rootStyle,
  rootClassName = 'scene-cell-chain-tooltip',
}: Props) {
  const baseDisabled = !connected || busy || !chainSynced
  const { up: upSol, down: downSol } = yourUpDownSol(position)
  const canUnstake =
    position != null && position.isActive && position.amount > 0n

  return (
    <div className={rootClassName} style={rootStyle} role="region">
      <p className="scene-chain-tip-lead">
        <strong>{timeLabel}</strong> · <strong>{altLabel}</strong>
      </p>
      {scene ? (
        <>
          <dl className="scene-chain-dl">
            <dt>Rank (this scene)</dt>
            <dd>{scene.rank.toString()}</dd>
            <dt>Total active stake (this scene)</dt>
            <dd>{lamportsToSol(scene.activeStake)} SOL</dd>
            <dt>Your upstake</dt>
            <dd>{upSol} SOL</dd>
            <dt>Your downstake</dt>
            <dd>{downSol} SOL</dd>
            <dt className="muted">Scene key</dt>
            <dd className="muted scene-key-mono">{sceneKeyHex.slice(0, 16)}…</dd>
          </dl>
          {canUnstake ? (
            <div className="scene-chain-tip-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={baseDisabled}
                onClick={() => void onUnstake(sceneKeyHex)}
              >
                Unstake
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted scene-chain-tip-copy">
          Scene not registered on-chain yet. Connect the <strong>slot authority</strong>{' '}
          wallet, add or confirm the YouTube URL on this cell (Scene tab), then refresh —
          that registers one <code>Scene</code> PDA per playable cell.
        </p>
      )}
    </div>
  )
}
