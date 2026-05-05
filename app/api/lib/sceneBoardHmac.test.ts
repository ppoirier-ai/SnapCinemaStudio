import { describe, expect, it } from 'vitest'
import {
  isCloudPayloadV1,
  signBoardJwt,
  verifyBoardJwt,
} from './sceneBoardHmac.js'

describe('sceneBoardHmac', () => {
  const secret = 'test-secret-at-least-thirty-two-bytes'

  it('roundtrips JWT', () => {
    const exp = Math.floor(Date.now() / 1000) + 120
    const t = signBoardJwt('SomeWallet123', exp, secret)
    expect(verifyBoardJwt(t, secret)).toEqual({ wallet: 'SomeWallet123' })
  })

  it('rejects expired JWT', () => {
    const exp = Math.floor(Date.now() / 1000) - 120
    const t = signBoardJwt('w', exp, secret)
    expect(verifyBoardJwt(t, secret)).toBeNull()
  })

  it('isCloudPayloadV1 guards payload shape', () => {
    expect(isCloudPayloadV1({ v: 1, updatedAtMs: 1, state: {} })).toBe(true)
    expect(isCloudPayloadV1({ v: 2, updatedAtMs: 1, state: {} })).toBe(false)
    expect(isCloudPayloadV1(null)).toBe(false)
  })
})
