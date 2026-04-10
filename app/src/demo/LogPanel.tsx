type Props = {
  lines: string[]
}

export function LogPanel({ lines }: Props) {
  return (
    <section className="panel log-panel" aria-labelledby="log-heading">
      <h2 id="log-heading">Log</h2>
      <pre className={`log${lines.length === 0 ? ' log-empty-state' : ''}`}>
        {lines.length > 0 ? lines.join('\n') : 'No events yet — actions append here.'}
      </pre>
    </section>
  )
}
