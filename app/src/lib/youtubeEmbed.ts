import { getMortalBlockchainsFilmVideoId } from '../config/mortalBlockchainsFilm'
import { extractYoutubeVideoId } from './youtubeUrl'

/**
 * YouTube Shorts use the same embed URL as regular videos once you have the video id.
 * Set `VITE_YOUTUBE_SHORT_ID` (11-char id) or a full `VITE_YOUTUBE_EMBED_URL`.
 * If unset, defaults to the Mortal Blockchains film (watch URL in `mortalBlockchainsFilm.ts`).
 */
export function youtubeEmbedSrc(): string | null {
  const id = import.meta.env.VITE_YOUTUBE_SHORT_ID?.trim()
  if (id)
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0`
  const full = import.meta.env.VITE_YOUTUBE_EMBED_URL?.trim()
  if (full) {
    const vid = extractYoutubeVideoId(full)
    if (vid)
      return `https://www.youtube.com/embed/${encodeURIComponent(vid)}?rel=0`
    return full
  }
  const fallback = getMortalBlockchainsFilmVideoId()
  return fallback
    ? `https://www.youtube.com/embed/${encodeURIComponent(fallback)}?rel=0`
    : null
}

/** Video id from env for programmatic embed (IFrame API), or null. */
export function envYoutubeVideoId(): string | null {
  const id = import.meta.env.VITE_YOUTUBE_SHORT_ID?.trim()
  if (id && /^[\w-]{11}$/.test(id)) return id
  const full = import.meta.env.VITE_YOUTUBE_EMBED_URL?.trim()
  if (full) return extractYoutubeVideoId(full)
  return getMortalBlockchainsFilmVideoId()
}
