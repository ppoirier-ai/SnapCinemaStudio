import type { CSSProperties } from 'react'
import { decodePosition, decodeVersion } from '../stakeToCurate/client'
import { lamportsToSol } from './format'

type V = ReturnType<typeof decodeVersion>
type P = ReturnType<typeof decodePosition>

export type SceneForkHoverPanelProps = {
  timeLabel: string
  altLabel: string
  fork: 0 | 1 | null
  playableCount: number
  chainSynced: boolean
  connected: boolean
  busy: boolean
  v0: V | null
  v1: V | null
  pos0: P | null
  pos1: P | null
  onUnstake: (versionIndex: 0 | 1) => void
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
  fork,
  playableCount,
  chainSynced,
  connected,
  busy,
  v0,
  v1,
  pos0,
  pos1,
  onUnstake,
  rootStyle,
  rootClassName = 'scene-cell-chain-tooltip',
}: Props) {
  const baseDisabled = !connected || busy || !chainSynced

  if (fork === null) {
    return (
      <div className={rootClassName} style={rootStyle} role="region">
        <p className="scene-chain-tip-lead">
          <strong>{timeLabel}</strong> · <strong>{altLabel}</strong>
        </p>
        {playableCount === 0 || playableCount === 1 ? (
          <p className="muted scene-chain-tip-copy">
            Curator stakes use two global forks (same as Watch). Give this time column{' '}
            <strong>exactly two</strong> playable clips: <strong>Alt 1</strong> → fork
            0, <strong>Alt 2</strong> → fork 1.
          </p>
        ) : (
          <p className="muted scene-chain-tip-copy">
            This column has <strong>{playableCount}</strong> clips. For a clear fork
            mapping, use <strong>exactly two</strong> alternates here (Alt 1 = fork 0,
            Alt 2 = fork 1).
          </p>
        )}
      </div>
    )
  }

  const vThis = fork === 0 ? v0 : v1
  const posThis = fork === 0 ? pos0 : pos1
  const { up: upSol, down: downSol } = yourUpDownSol(posThis)
  const verBusy = baseDisabled || !vThis
  const canUnstake =
    posThis != null &&
    posThis.isActive &&
    posThis.amount > 0n

  return (
    <div className={rootClassName} style={rootStyle} role="region">
      <p className="scene-chain-tip-lead">
        <strong>{timeLabel}</strong> · <strong>{altLabel}</strong>
      </p>
      {vThis ? (
        <>
          <dl className="scene-chain-dl">
            <dt>Rank (this fork)</dt>
            <dd>{vThis.rank.toString()}</dd>
            <dt>Total active stake (this fork)</dt>
            <dd>{lamportsToSol(vThis.activeStake)} SOL</dd>
            <dt>Your upstake</dt>
            <dd>{upSol} SOL</dd>
            <dt>Your downstake</dt>
            <dd>{downSol} SOL</dd>
          </dl>
          {canUnstake ? (
            <div className="scene-chain-tip-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={verBusy}
                onClick={() => void onUnstake(fork)}
              >
                Unstake
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted scene-chain-tip-copy">
          Fork accounts not on-chain yet — platform admin runs Setup in Studio.
        </p>
      )}
    </div>
  )
}
