import { sha256 } from '@noble/hashes/sha256'

/**
 * 32-byte scene identity (matches on-chain `scene_key` and `scene_key_from_ids` in the program).
 * Packing: UTF-8 `movieId`, 0x00, UTF-8 `columnId`, 0x00, UTF-8 `cellId`, then SHA-256.
 */
export function sceneKeyBytes(
  movieId: string,
  columnId: string,
  cellId: string,
): Uint8Array {
  const te = new TextEncoder()
  const a = te.encode(movieId)
  const b = te.encode(columnId)
  const c = te.encode(cellId)
  const buf = new Uint8Array(a.length + 1 + b.length + 1 + c.length)
  let o = 0
  buf.set(a, o)
  o += a.length
  buf[o++] = 0
  buf.set(b, o)
  o += b.length
  buf[o++] = 0
  buf.set(c, o)
  return sha256(buf)
}

export function sceneKeyHex(
  movieId: string,
  columnId: string,
  cellId: string,
): string {
  return bytesToHex(sceneKeyBytes(movieId, columnId, cellId))
}

export function hexToSceneKeyBytes(hex: string): Uint8Array {
  const h = hex.trim().toLowerCase()
  if (h.length !== 64 || !/^[0-9a-f]+$/.test(h)) {
    throw new Error('scene_key hex must be 64 hex characters')
  }
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function bytesToHex(bytes: Uint8Array | { readonly length: number; [i: number]: number }): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, '0')
  }
  return s
}
