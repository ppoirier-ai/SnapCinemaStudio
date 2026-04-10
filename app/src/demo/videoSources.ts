/**
 * Fan tab playback: prefer hosted media. Env overrides or /public demo files.
 * Creators contribute YouTube URLs in-app; watch page uses VITE_YOUTUBE_* for the main embed.
 */
export function demoVideoSrc(version: 0 | 1): string | undefined {
  const raw =
    version === 0
      ? import.meta.env.VITE_DEMO_VIDEO_V0
      : import.meta.env.VITE_DEMO_VIDEO_V1
  if (raw && String(raw).trim()) return String(raw).trim()
  const path = version === 0 ? '/demo-v0.mp4' : '/demo-v1.mp4'
  return path
}
