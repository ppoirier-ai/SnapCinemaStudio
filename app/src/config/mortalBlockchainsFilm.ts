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

/** Privacy-enhanced embed host (matches tests on snapcinema.site). */
const MORTAL_BLOCKCHAINS_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'

/**
 * Featured-film iframe: muted autoplay only.
 * Do not use loop + playlist with the same video id for this upload — it triggers
 * “unavailable” / ytp-embed-error in embeds.
 */
export function getMortalBlockchainsFeaturedFilmEmbedSrc(): string | null {
  const id = MORTAL_BLOCKCHAINS_FILM_VIDEO_ID
  if (!id) return null
  const q = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
  })
  return `${MORTAL_BLOCKCHAINS_EMBED_ORIGIN}/embed/${encodeURIComponent(id)}?${q}`
}
