import type { VercelRequest } from '@vercel/node'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertJsonBodyWithinContentLength,
  PayloadTooLargeError,
} from './requestLimits.js'

describe('requestLimits', () => {
  afterEach(() => {
    delete process.env.API_MAX_JSON_BODY_BYTES
  })

  it('throws PayloadTooLargeError when Content-Length exceeds max', () => {
    process.env.API_MAX_JSON_BODY_BYTES = '100'
    const req = {
      headers: { 'content-length': '9999' },
    } as unknown as VercelRequest
    expect(() => assertJsonBodyWithinContentLength(req)).toThrow(
      PayloadTooLargeError,
    )
  })

  it('allows missing content-length', () => {
    const req = { headers: {} } as unknown as VercelRequest
    expect(() => assertJsonBodyWithinContentLength(req)).not.toThrow()
  })
})
