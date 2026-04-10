/** Accepts watch, shorts, youtu.be, and embed URLs (querystrings allowed). */
export function isProbablyYoutubeUrl(raw: string): boolean {
  const s = raw.trim().toLowerCase()
  if (!s) return false
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    const host = u.hostname.replace(/^www\./, '')
    return (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host === 'music.youtube.com'
    )
  } catch {
    return false
  }
}
