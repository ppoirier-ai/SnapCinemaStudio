/** Accepts watch, shorts, youtu.be, and embed URLs (querystrings allowed). */
export function isProbablyYoutubeUrl(raw: string): boolean {
  return extractYoutubeVideoId(raw) !== null
}

/** Returns 11-character video id or null. */
export function extractYoutubeVideoId(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    if (host.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      const shorts = u.pathname.match(/\/shorts\/([\w-]{11})/)
      if (shorts) return shorts[1]
      const embed = u.pathname.match(/\/embed\/([\w-]{11})/)
      if (embed) return embed[1]
    }
  } catch {
    /* ignore */
  }
  return null
}

export function youtubeThumbnailUrl(
  videoId: string,
  quality: 'hq' | 'mq' = 'mq',
): string {
  return quality === 'hq'
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}
