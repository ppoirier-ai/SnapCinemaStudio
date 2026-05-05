import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAsync = vi.fn()

vi.mock('@noble/ed25519', () => ({
  verifyAsync: (...args: unknown[]) => verifyAsync(...args),
}))

import { verifySolanaWalletSignMessage } from './verifySolanaWalletSignMessage.js'

const WALLET = '5m9EpMNkFn13PSFBAmQB16wjBSWnfRKMFPBkEYod5REW'
const MSG_RE =
  /^SnapCinema:scene-board:v1:([^:]+):(\d+):([0-9a-f-]{36})$/i

describe('verifySolanaWalletSignMessage', () => {
  beforeEach(() => {
    verifyAsync.mockResolvedValue(true)
  })

  it('rejects invalid message format before calling verifyAsync', async () => {
    const r = await verifySolanaWalletSignMessage({
      wallet: WALLET,
      message: 'totally-wrong',
      signatureBase64: Buffer.alloc(64, 1).toString('base64'),
      messageRegex: MSG_RE,
    })
    expect(r.ok).toBe(false)
    expect(verifyAsync).not.toHaveBeenCalled()
  })

  it('accepts when noble verifies', async () => {
    const ts = Date.now()
    const message = `SnapCinema:scene-board:v1:${WALLET}:${ts}:550e8400-e29b-41d4-a716-446655440000`
    const r = await verifySolanaWalletSignMessage({
      wallet: WALLET,
      message,
      signatureBase64: Buffer.alloc(64, 2).toString('base64'),
      messageRegex: MSG_RE,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.walletPubkeyBytes).toBeInstanceOf(Uint8Array)
    expect(verifyAsync).toHaveBeenCalledOnce()
  })
})
