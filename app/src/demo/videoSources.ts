/**
 * Optional overrides via .env; otherwise use files in /public (see README).
 * If unset and public files missing, FanStage shows a placeholder (no broken video).
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
