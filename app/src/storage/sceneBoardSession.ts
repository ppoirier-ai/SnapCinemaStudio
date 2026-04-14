const SESSION_KEY = 'snapcinema-board-api-session'

type BoardApiSession = { token: string; expSec: number; wallet: string }

function readViteEnv(name: string): string | undefined {
  const im =
    typeof import.meta !== 'undefined'
      ? (import.meta as ImportMeta & { env?: Record<string, string> }).env
      : undefined
  const fromVite = im?.[name]
  if (fromVite != null && String(fromVite).trim() !== '') return String(fromVite)
  if (typeof process !== 'undefined') {
    const p = process.env[name]
    if (p != null && String(p).trim() !== '') return String(p)
  }
  return undefined
}

/** Optional: full origin of deployed app for `/api/scene-board` when running Vite on :5173. */
export function sceneBoardApiBase(): string {
  return readViteEnv('VITE_SCENE_BOARD_API_URL')?.replace(/\/$/, '') ?? ''
}

export function sceneBoardApiUrl(path: string): string {
  const base = sceneBoardApiBase()
  return `${base}${path}`
}

function bytesToB64(u: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]!)
  return btoa(bin)
}

export function readBoardApiSession(wallet: string): BoardApiSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<BoardApiSession>
    if (
      p.wallet !== wallet ||
      typeof p.token !== 'string' ||
      typeof p.expSec !== 'number'
    )
      return null
    return p as BoardApiSession
  } catch {
    return null
  }
}

export function writeBoardApiSession(s: BoardApiSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    /* private mode */
  }
}

export async function createBoardApiSession(
  wallet: string,
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
): Promise<string | null> {
  const message = `SnapCinema:scene-board:v1:${wallet}:${Date.now()}:${crypto.randomUUID()}`
  const sig = await signMessage(new TextEncoder().encode(message))
  const res = await fetch(sceneBoardApiUrl('/api/scene-board'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      op: 'session',
      wallet,
      message,
      signature: bytesToB64(sig),
    }),
  })
  if (!res.ok) {
    console.warn('[scene-board] session HTTP', res.status, await res.text())
    return null
  }
  const j = (await res.json()) as { token?: string; expSec?: number }
  if (!j.token || typeof j.expSec !== 'number') return null
  writeBoardApiSession({ token: j.token, expSec: j.expSec, wallet })
  return j.token
}

export async function ensureBoardApiSession(
  wallet: string,
  signMessage: ((msg: Uint8Array) => Promise<Uint8Array>) | undefined,
): Promise<string | null> {
  if (!signMessage) return null
  const cur = readBoardApiSession(wallet)
  if (cur && cur.expSec * 1000 > Date.now() + 60_000) return cur.token
  return createBoardApiSession(wallet, signMessage)
}
