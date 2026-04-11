type Props = {
  slotInitialized: boolean
  registeredSceneCount: number
  connected: boolean
}

export function VersionsPanel({
  slotInitialized,
  registeredSceneCount,
  connected,
}: Props) {
  const hint = !connected
    ? 'Connect wallet to load on-chain data.'
    : !slotInitialized
      ? 'No slot yet — platform admin must run Setup (init slot).'
      : 'Scenes are created per playable cell when the slot authority saves YouTube URLs on the Scene tab.'

  return (
    <section className="panel" aria-labelledby="versions-heading">
      <h2 id="versions-heading">2. Slot &amp; scenes</h2>
      <p className="muted">{hint}</p>
      {slotInitialized && (
        <ul className="stats">
          <li>Registered scene accounts (cached in this session): {registeredSceneCount}</li>
        </ul>
      )}
    </section>
  )
}
