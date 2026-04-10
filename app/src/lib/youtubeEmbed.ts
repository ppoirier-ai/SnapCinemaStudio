import { extractYoutubeVideoId } from './youtubeUrl'

/**
 * YouTube Shorts use the same embed URL as regular videos once you have the video id.
 * Set `VITE_YOUTUBE_SHORT_ID` (11-char id) or a full `VITE_YOUTUBE_EMBED_URL`.
 */
export function youtubeEmbedSrc(): string | null {
  const id = import.meta.env.VITE_YOUTUBE_SHORT_ID?.trim()
  if (id)
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0`
  const full = import.meta.env.VITE_YOUTUBE_EMBED_URL?.trim()
  return full || null
}

/** Video id from env for programmatic embed (IFrame API), or null. */
export function envYoutubeVideoId(): string | null {
  const id = import.meta.env.VITE_YOUTUBE_SHORT_ID?.trim()
  if (id && /^[\w-]{11}$/.test(id)) return id
  const full = import.meta.env.VITE_YOUTUBE_EMBED_URL?.trim()
  if (full) return extractYoutubeVideoId(full)
  return null
}
