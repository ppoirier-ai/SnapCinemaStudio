import { extractYoutubeVideoId } from '../lib/youtubeUrl'

/** Canonical watch URL for the Mortal Blockchains feature film. */
export const MORTAL_BLOCKCHAINS_FILM_YOUTUBE_URL =
  'https://www.youtube.com/watch?v=qHBdKRhJ1Ew'

const MORTAL_BLOCKCHAINS_FILM_VIDEO_ID = extractYoutubeVideoId(
  MORTAL_BLOCKCHAINS_FILM_YOUTUBE_URL,
)

export function getMortalBlockchainsFilmVideoId(): string | null {
  return MORTAL_BLOCKCHAINS_FILM_VIDEO_ID
}

/** Featured-film iframe: autoplay, loop, muted (browser autoplay policy). */
export function getMortalBlockchainsFeaturedFilmEmbedSrc(): string | null {
  const id = MORTAL_BLOCKCHAINS_FILM_VIDEO_ID
  if (!id) return null
  const q = new URLSearchParams({
    autoplay: '1',
    loop: '1',
    playlist: id,
    mute: '1',
    playsinline: '1',
    rel: '0',
  })
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?${q}`
}
