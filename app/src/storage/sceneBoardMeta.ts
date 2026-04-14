const META_KEY = 'snapcinema-movies-v2-meta'

export type SceneBoardLocalMeta = {
  lastLocalWriteMs: number
}

export function readLocalMeta(): SceneBoardLocalMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return { lastLocalWriteMs: 0 }
    const p = JSON.parse(raw) as Partial<SceneBoardLocalMeta>
    return {
      lastLocalWriteMs:
        typeof p.lastLocalWriteMs === 'number' ? p.lastLocalWriteMs : 0,
    }
  } catch {
    return { lastLocalWriteMs: 0 }
  }
}

export function writeLocalMeta(m: SceneBoardLocalMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m))
  } catch {
    /* quota */
  }
}
